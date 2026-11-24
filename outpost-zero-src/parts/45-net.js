/* Browser-to-browser networking, the same way Side Pot does it: the host's tab
   runs the match and everyone connects straight to it over WebRTC. The PeerJS
   broker only introduces the browsers; game traffic never goes through it. */

const NET_PREFIX = 'outpost-zero-v1-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];
const PEER_OPTIONS = { debug: 0, config: { iceServers: ICE_SERVERS } };

const Net = {
  peer: null, isHost: false, code: null, conns: new Map(), hostConn: null, seq: 0, closing: false,
  // set by the game
  onHostMsg: null, onJoin: null, onLeave: null, onClientMsg: null, onDrop: null,

  makeCode() { let s = ''; for (let i = 0; i < 4; i++) s += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0]; return s; },

  host(onReady, onFail, tries = 0) {
    if (typeof window.Peer !== 'function') { onFail('The connection library did not load.'); return; }
    this.close(); this.closing = false; this.isHost = true;
    const code = this.makeCode();
    const peer = this.peer = new Peer(NET_PREFIX + code, PEER_OPTIONS);
    let opened = false;
    peer.on('open', () => { opened = true; this.code = code; onReady(code); });
    peer.on('connection', conn => {
      const id = 'p' + (++this.seq);
      conn.on('open', () => { this.conns.set(id, conn); if (this.onJoin) this.onJoin(id); });
      conn.on('data', d => { if (this.onHostMsg && d && typeof d === 'object') this.onHostMsg(id, d); });
      conn.on('close', () => { if (this.conns.delete(id) && this.onLeave) this.onLeave(id); });
      conn.on('error', () => {});
    });
    peer.on('disconnected', () => { if (!this.closing) { try { peer.reconnect(); } catch (e) {} } });
    peer.on('error', err => {
      if (err && err.type === 'unavailable-id' && tries < 5) { this.close(); this.host(onReady, onFail, tries + 1); return; }
      if (!opened) onFail(err && err.type === 'network' ? 'Could not reach the match finder. Check your internet.' : 'Could not start hosting (' + (err && err.type) + ').');
    });
  },

  join(code, onOpen, onFail) {
    if (typeof window.Peer !== 'function') { onFail('The connection library did not load.'); return; }
    this.close(); this.closing = false; this.isHost = false;
    const peer = this.peer = new Peer(PEER_OPTIONS);
    let done = false;
    const fail = msg => { if (done) return; done = true; clearTimeout(timer); this.close(); onFail(msg); };
    const timer = setTimeout(() => fail('No answer from that match. Check the code and try again.'), 15000);
    peer.on('open', () => {
      const conn = this.hostConn = peer.connect(NET_PREFIX + code, { reliable: true, serialization: 'json' });
      conn.on('open', () => { if (done) return; done = true; clearTimeout(timer); this.code = code; onOpen(); });
      conn.on('data', d => { if (this.onClientMsg && d && typeof d === 'object') this.onClientMsg(d); });
      conn.on('close', () => { if (done && !this.closing && this.onDrop) this.onDrop(); });
      conn.on('error', () => {});
    });
    peer.on('error', err => {
      if (err && err.type === 'peer-unavailable') fail('No match with code ' + code + '. Check the code with the host.');
      else if (!done) fail('Could not connect (' + (err && err.type) + ').');
    });
  },

  sendHost(msg) { if (this.hostConn && this.hostConn.open) this.hostConn.send(msg); },
  sendTo(id, msg) { const c = this.conns.get(id); if (c && c.open) c.send(msg); },
  sendAll(msg, except) { for (const [id, c] of this.conns) if (id !== except && c.open) c.send(msg); },
  kick(id) { const c = this.conns.get(id); if (c) { try { c.close(); } catch (e) {} } },
  close() {
    this.closing = true;
    for (const c of this.conns.values()) { try { c.close(); } catch (e) {} }
    this.conns.clear();
    if (this.hostConn) { try { this.hostConn.close(); } catch (e) {} this.hostConn = null; }
    if (this.peer) { try { this.peer.destroy(); } catch (e) {} this.peer = null; }
    this.code = null;
  },
};
