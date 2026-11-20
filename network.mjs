const iceServers = [{ urls: 'stun:stun.cloudflare.com:3478' }];
const codePrefix = 'MF1';
const channelLabel = 'game';
const maxCodeLength = 40_000;
const maxMessageLength = 16_384;

function encodeCode({ type, sdp }) {
  const bytes = new TextEncoder().encode(sdp);
  const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
  const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${codePrefix}.${type}.${encoded}`;
}

function decodeCode(code, type) {
  const prefix = `${codePrefix}.${type}.`;
  const value = typeof code === 'string' && code.trim();
  if (!value || value.length > maxCodeLength || !value.startsWith(prefix)) {
    throw new Error(type === 'offer' ? 'Нужен код приглашения.' : 'Нужен код ответа друга.');
  }

  const encoded = value.slice(prefix.length);
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error();
    const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const sdp = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (!sdp.startsWith('v=0\r\n') || !sdp.includes('\r\nm=application ')) throw new Error();
    return { type, sdp };
  } catch {
    throw new Error('Код повреждён. Скопируй его целиком.');
  }
}

function waitForIce(peer, signal) {
  return new Promise((resolve, reject) => {
    let timer;
    const clean = () => {
      clearTimeout(timer);
      peer.removeEventListener('icegatheringstatechange', synchronize);
      signal.removeEventListener('abort', cancel);
    };
    const finish = () => {
      clean();
      resolve();
    };
    const cancel = () => {
      clean();
      reject(signal.reason);
    };
    const synchronize = () => {
      if (peer.iceGatheringState === 'complete') finish();
    };
    if (signal.aborted) {
      cancel();
      return;
    }
    if (peer.iceGatheringState === 'complete') {
      resolve();
      return;
    }
    peer.addEventListener('icegatheringstatechange', synchronize);
    signal.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(finish, 7_000);
  });
}

export class PeerLink {
  #peer;
  #channel;
  #abort;
  #timer;
  #onState;
  #onMessage;
  #state = 'idle';

  constructor({ onState = () => {}, onMessage = () => {} } = {}) {
    this.#onState = onState;
    this.#onMessage = onMessage;
  }

  get state() {
    return this.#state;
  }

  createOffer() {
    return this.#prepare();
  }

  async acceptOffer(offer) {
    return this.#prepare(decodeCode(offer, 'offer'));
  }

  async acceptAnswer(answer) {
    if (this.#state !== 'waiting') throw new Error('Сначала создай приглашение.');
    const description = decodeCode(answer, 'answer');
    const peer = this.#peer;
    const signal = this.#abort.signal;
    this.#setState('connecting', 'Соединяемся с другом…');
    try {
      await peer.setRemoteDescription(description);
      signal.throwIfAborted();
    } catch {
      signal.throwIfAborted();
      this.#setState('waiting', 'Вставь ответ на это приглашение.');
      throw new Error('Не удалось применить ответ. Попроси друга открыть новое приглашение.');
    }
    if (this.#state === 'connecting') this.#startTimeout(peer, 25_000);
  }

  send(message) {
    const channel = this.#channel;
    if (channel?.readyState !== 'open' || channel.bufferedAmount > 262_144) return false;
    try {
      const data = JSON.stringify(message);
      if (typeof data !== 'string' || data.length > maxMessageLength) return false;
      channel.send(data);
      return true;
    } catch {
      return false;
    }
  }

  close() {
    this.#dispose();
    this.#setState('closed', 'Соединение закрыто.');
  }

  async #prepare(offer) {
    this.#dispose();
    if (typeof RTCPeerConnection !== 'function') {
      const message = 'В этом браузере недоступен WebRTC.';
      this.#setState('failed', message);
      throw new Error(message);
    }
    const peer = new RTCPeerConnection({ iceServers });
    this.#peer = peer;
    this.#abort = new AbortController();
    const signal = this.#abort.signal;
    this.#setState('preparing', offer ? 'Готовим ответ…' : 'Создаём приглашение…');
    peer.addEventListener('connectionstatechange', () => this.#updateConnection(peer));

    try {
      if (offer) {
        peer.addEventListener('datachannel', ({ channel }) => this.#bindChannel(peer, channel));
        await peer.setRemoteDescription(offer);
        await peer.setLocalDescription(await peer.createAnswer());
      } else {
        this.#bindChannel(peer, peer.createDataChannel(channelLabel));
        await peer.setLocalDescription(await peer.createOffer());
      }
      await waitForIce(peer, signal);
      signal.throwIfAborted();
    } catch {
      signal.throwIfAborted();
      const message = offer ? 'Не удалось открыть приглашение.' : 'Не удалось создать приглашение.';
      this.#fail(message);
      throw new Error(message);
    }

    const code = encodeCode(peer.localDescription);
    if (offer) {
      if (this.#state !== 'open') {
        this.#setState('connecting', 'Отправь код ответа другу.');
        this.#startTimeout(peer, 120_000);
      }
    } else {
      this.#setState('waiting', 'Ждём код ответа от друга.');
    }
    return code;
  }

  #setState(state, detail) {
    this.#state = state;
    this.#onState(state, detail);
  }

  #bindChannel(peer, channel) {
    if (this.#peer !== peer || channel.label !== channelLabel || this.#channel) {
      channel.close();
      return;
    }
    this.#channel = channel;
    const open = () => {
      if (this.#peer !== peer || this.#state === 'open') return;
      clearTimeout(this.#timer);
      this.#setState('open', 'Друг подключился.');
    };
    channel.addEventListener('open', open);
    if (channel.readyState === 'open') open();
    channel.addEventListener('message', ({ data }) => {
      if (this.#peer !== peer || typeof data !== 'string' || data.length > maxMessageLength) return;
      let message;
      try {
        message = JSON.parse(data);
      } catch {
        return;
      }
      this.#onMessage(message);
    });
    channel.addEventListener('error', () => {
      if (this.#peer === peer) this.#fail('Ошибка сетевого соединения.');
    });
    channel.addEventListener('close', () => {
      if (this.#peer !== peer) return;
      this.#dispose();
      this.#setState('closed', 'Связь с другом закрыта.');
    });
  }

  #updateConnection(peer) {
    if (this.#peer !== peer) return;
    if (peer.connectionState === 'failed') {
      this.#fail('Не удалось связаться с другом. Попробуйте другую сеть или подключитесь к одному Wi-Fi.');
    }
    if (this.#state !== 'open') return;
    if (peer.connectionState === 'disconnected') this.#startTimeout(peer, 10_000);
    if (peer.connectionState === 'connected') clearTimeout(this.#timer);
  }

  #startTimeout(peer, delay) {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      if (this.#peer === peer) this.#fail('Время подключения вышло. Создай новое приглашение.');
    }, delay);
  }

  #fail(message) {
    this.#dispose();
    this.#setState('failed', message);
  }

  #dispose() {
    const peer = this.#peer;
    const channel = this.#channel;
    this.#peer = undefined;
    this.#channel = undefined;
    clearTimeout(this.#timer);
    this.#abort?.abort(new DOMException('Подключение отменено.', 'AbortError'));
    channel?.close();
    peer?.close();
  }
}
