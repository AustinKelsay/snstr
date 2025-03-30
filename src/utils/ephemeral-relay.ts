import { z } from 'zod'
import { schnorr } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha256'
import { EventEmitter } from 'node:events'
import { WebSocket, WebSocketServer } from 'ws'

/* ================ [ Configuration ] ================ */

const HOST    = 'ws://localhost'
const DEBUG   = process.env['DEBUG']   === 'true'
const VERBOSE = process.env['VERBOSE'] === 'true' || DEBUG

console.log('output mode:', DEBUG ? 'debug' : VERBOSE ? 'verbose' : 'silent')

/* ================ [ Interfaces ] ================ */

interface EventFilter {
  ids?: string[]
  authors?: string[]
  kinds?: number[]
  since?: number
  until?: number
  limit?: number
  [key: string]: any | undefined
}

interface SignedEvent {
  content: string
  created_at: number
  id: string
  kind: number
  pubkey: string
  sig: string
  tags: string[][]
}

interface Subscription {
  filters: EventFilter[]
  instance: ClientSession,
  sub_id: string
}

/* ================ [ Schema ] ================ */

const num = z.number().max(Number.MAX_SAFE_INTEGER),
  str = z.string(),
  stamp = num.min(500_000_000),
  hex = str.regex(/^[0-9a-fA-F]*$/).refine(e => e.length % 2 === 0),
  hash = hex.refine((e) => e.length === 64),
  sig = hex.refine((e) => e.length === 128),
  tags = str.array()

const event_schema = z.object({
  content: str,
  created_at: stamp,
  id: hash,
  kind: num,
  pubkey: hash,
  sig: sig,
  tags: tags.array()
})

const filter_schema = z.object({
  ids: hash.array().optional(),
  authors: hash.array().optional(),
  kinds: num.array().optional(),
  since: stamp.optional(),
  until: stamp.optional(),
  limit: num.optional(),
}).catchall(tags)

const sub_schema = z.tuple([str]).rest(filter_schema)

/* ================ [ Server Class ] ================ */

export class NostrRelay {
  private readonly _emitter: EventEmitter
  private readonly _port: number
  private readonly _purge: number | null
  private readonly _subs: Map<string, Subscription>

  private _wss: WebSocketServer | null
  private _cache: SignedEvent[]

  public conn: number

  constructor(port: number, purge_ival?: number) {
    this._cache = []
    this._emitter = new EventEmitter
    this._port = port
    this._purge = purge_ival ?? null
    this._subs = new Map()
    this._wss = null
    this.conn = 0
  }

  get cache() {
    return this._cache
  }

  get subs() {
    return this._subs
  }

  get url() {
    return `${HOST}:${this._port}`
  }

  get wss() {
    if (this._wss === null) {
      throw new Error('websocket server not initialized')
    }
    return this._wss
  }

  async start() {
    this._wss = new WebSocketServer({ port: this._port })

    DEBUG && console.log('[ relay ] running on port:', this._port)

    this.wss.on('connection', socket => {
      const instance = new ClientSession(this, socket)

      socket.on('message', msg => instance._handler(msg.toString()))
      socket.on('error', err => instance._onerr(err))
      socket.on('close', code => instance._cleanup(code))

      this.conn += 1
    })

    return new Promise(res => {
      this.wss.on('listening', () => {
        if (this._purge !== null) {
          DEBUG && console.log(`[ relay ] purging events every ${this._purge} seconds`)
          setInterval(() => {
            this._cache = []
          }, this._purge * 1000)
        }
        this._emitter.emit('connected')
        res(this)
      })
    })
  }

  onconnect(cb: () => void) {
    this._emitter.on('connected', cb)
  }

  close() {
    this.wss.close()
  }

  store(event: SignedEvent) {
    this._cache = this._cache.concat(event).sort((a, b) => a > b ? -1 : 1)
  }
}

/* ================ [ Instance Class ] ================ */

class ClientSession {

  private readonly _sid: string
  private readonly _relay: NostrRelay
  private readonly _socket: WebSocket
  private readonly _subs: Set<string>

  constructor(
    relay: NostrRelay,
    socket: WebSocket
  ) {
    this._relay = relay
    this._sid = Math.random().toString().slice(2, 8)
    this._socket = socket
    this._subs = new Set()

    this.log.client('client connected')
  }

  get sid() {
    return this._sid
  }

  get relay() {
    return this._relay
  }

  get socket() {
    return this._socket
  }

  _cleanup(code: number) {
    this.socket.close()
    for (const subId of this._subs) {
      this.remSub(subId)
    }
    this.relay.conn -= 1
    this.log.client(`[ ${this._sid} ]`, 'client disconnected with code:', code)
  }

  _handler(message: string) {
    let verb: string, payload: any

    try {
      [verb, ...payload] = JSON.parse(message)
      assert(typeof verb === 'string')

      switch (verb) {
        case 'REQ':
          const [id, ...filters] = sub_schema.parse(payload)
          return this._onreq(id, filters)
        case 'EVENT':
          const event = event_schema.parse(payload.at(0))
          return this._onevent(event)
        case 'CLOSE':
          const subid = str.parse(payload.at(0))
          return this._onclose(subid)
        default:
          this.log.info('unable to handle message type:', verb)
          this.send(['NOTICE', '', 'Unable to handle message'])
      }
    } catch (e) {
      this.log.debug('failed to parse message:\n\n', message)
      return this.send(['NOTICE', '', 'Unable to parse message'])
    }
  }

  _onclose(sub_id: string) {
    this.log.info('closed subscription:', sub_id)
    this.remSub(sub_id)
  }

  _onerr(err: Error) {
    this.log.info('socket encountered an error:\n\n', err)
  }

  _onevent(event: SignedEvent) {
    this.log.client('received event id:', event.id)
    this.log.debug('event:', event)

    if (!verify_event(event)) {
      this.log.debug('event failed validation:', event)
      this.send(['OK', event.id, false, 'event failed validation'])
      return
    }

    this.send(['OK', event.id, true, ''])
    this.relay.store(event)

    for (const { filters, instance, sub_id } of this.relay.subs.values()) {
      for (const filter of filters) {
        if (match_filter(event, filter)) {
          instance.log.client(`event matched subscription: ${sub_id}`)
          instance.send(['EVENT', sub_id, event])
        }
      }
    }
  }

  _onreq(
    sub_id: string,
    filters: EventFilter[]
  ): void {
    this.log.client('received subscription request:', sub_id)
    this.log.debug('filters:', filters)
    // Add the subscription to our set.
    this.addSub(sub_id, filters)
    // For each filter:
    for (const filter of filters) {
      // Set the limit count, if any.
      let limit_count = filter.limit
      // For each event in the cache:
      for (const event of this.relay.cache) {
        // If there is no limit, or we are above the limit:
        if (limit_count === undefined || limit_count > 0) {
          // If the event matches the current filter:
          if (match_filter(event, filter)) {
            // Send the event to the client.
            this.send(['EVENT', sub_id, event])
            this.log.client(`event matched in cache: ${event.id}`)
            this.log.client(`event matched subscription: ${sub_id}`)
          }
          // Update the limit count.
          if (limit_count !== undefined) limit_count -= 1
        }
      }
    }
    // Send an end of subscription event.
    this.log.debug('sending EOSE for subscription:', sub_id)
    this.send(['EOSE', sub_id])
  }

  get log() {
    return {
      client: (...msg: any[]) => VERBOSE && console.log(`[ client ][ ${this._sid} ]`, ...msg),
      debug: (...msg: any[]) => DEBUG && console.log(`[ debug  ][ ${this._sid} ]`, ...msg),
      info: (...msg: any[]) => VERBOSE && console.log(`[ info   ][ ${this._sid} ]`, ...msg),
    }
  }

  addSub(
    sub_id: string,
    ...filters: EventFilter[]
  ) {
    const uid = `${this.sid}/${sub_id}`
    this.relay.subs.set(uid, { filters, instance: this, sub_id })
    this._subs.add(sub_id)
  }

  remSub(subId: string) {
    this.relay.subs.delete(subId)
    this._subs.delete(subId)
  }

  send(message: any[]) {
    this._socket.send(JSON.stringify(message))
  }
}

/* ================ [ Methods ] ================ */

function assert(value: unknown): asserts value {
  if (value === false) throw new Error('assertion failed!')
}

function match_filter(
  event: SignedEvent,
  filter: EventFilter = {}
): boolean {
  const { authors, ids, kinds, since, until, limit, ...rest } = filter

  const tag_filters: string[][] = Object.entries(rest)
    .filter(e => e[0].startsWith('#'))
    .map(e => [e[0].slice(1, 2), ...e[1]])

  if (ids !== undefined && !ids.includes(event.id)) {
    return false
  } else if (since !== undefined && event.created_at < since) {
    return false
  } else if (until !== undefined && event.created_at > until) {
    return false
  } else if (authors !== undefined && !authors.includes(event.pubkey)) {
    return false
  } else if (kinds !== undefined && !kinds.includes(event.kind)) {
    return false
  } else if (tag_filters.length > 0) {
    return match_tags(tag_filters, event.tags)
  } else {
    return true
  }
}

function match_tags(
  filters: string[][],
  tags: string[][]
): boolean {
  for (const [key, ...terms] of filters) {
    for (const [tag, ...params] of tags) {
      if (tag === key) {
        for (const term of terms) {
          if (!params.includes(term)) {
            return false
          }
        }
      }
    }
  }
  return true
}

function verify_event(event: SignedEvent) {
  const { content, created_at, id, kind, pubkey, sig, tags } = event
  const pimg = JSON.stringify([0, pubkey, created_at, kind, tags, content])
  const dig = Buffer.from(sha256(pimg)).toString('hex')
  if (dig !== id) return false
  return schnorr.verify(sig, id, pubkey)
} 