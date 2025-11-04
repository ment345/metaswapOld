const state = {
  connected: false,
  walletType: null,
  walletAddress: null,
  walletBalances: { TON: 0, USDT: 0 },
  exchangeBalances: { TON: 0, USDT: 0 },
  rateTonToUsdt: 2.14,
  feePercent: 0.006,
  flatFee: 1.2,
  volume24h: 1_865_200,
  trades: 11_675,
  tradesHourDelta: 128,
  lastStatus: 'Подключите кошелёк',
  lastTone: 'info',
  lastStatusTime: null,
};

const els = {
  year: document.getElementById('year'),
  walletChip: document.getElementById('walletChip'),
  disconnectBtn: document.getElementById('disconnectBtn'),
  openWalletModal: document.getElementById('openWalletModal'),
  walletModal: document.getElementById('walletModal'),
  closeWalletModal: document.getElementById('closeWalletModal'),
  walletOptions: Array.from(document.querySelectorAll('.wallet-option')),
  fromAmount: document.getElementById('fromAmount'),
  fromToken: document.getElementById('fromToken'),
  toAmount: document.getElementById('toAmount'),
  toToken: document.getElementById('toToken'),
  flipPair: document.getElementById('flipPair'),
  fromBalance: document.getElementById('fromBalance'),
  feeInfo: document.getElementById('feeInfo'),
  swapForm: document.getElementById('swapForm'),
  swapStatus: document.getElementById('swapStatus'),
  swapStatusText: document.getElementById('swapStatusText'),
  swapStatusTime: document.getElementById('swapStatusTime'),
  walletTon: document.getElementById('walletTon'),
  walletUsdt: document.getElementById('walletUsdt'),
  exchangeTon: document.getElementById('exchangeTon'),
  exchangeUsdt: document.getElementById('exchangeUsdt'),
  withdrawTon: document.getElementById('withdrawTon'),
  rateValue: document.getElementById('rateValue'),
  avgFee: document.getElementById('avgFee'),
  volumeValue: document.getElementById('volumeValue'),
  tradesValue: document.getElementById('tradesValue'),
  hourlyDelta: document.getElementById('hourlyDelta'),
  metricTonUsdt: document.getElementById('metricTonUsdt'),
  metricVolume: document.getElementById('metricVolume'),
  metricFee: document.getElementById('metricFee'),
  metricTrades: document.getElementById('metricTrades'),
  metricDelta: document.getElementById('metricDelta'),
  toast: document.getElementById('toast'),
};

const numberFormat = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdFormat = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const tokenFormat = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

function init() {
  els.year.textContent = new Date().getFullYear();
  setupEvents();
  ensurePairIntegrity();
  updateRateDisplays();
  updateBalances();
  updateFormHints();
  updateMetrics();
  renderStatus();
  setInterval(applyRateDrift, 30_000);
}

function setupEvents() {
  els.openWalletModal.addEventListener('click', () => toggleWalletModal(true));
  document.querySelectorAll('[data-open-wallet]').forEach((btn) =>
    btn.addEventListener('click', () => toggleWalletModal(true))
  );
  els.closeWalletModal.addEventListener('click', () => toggleWalletModal(false));
  els.walletModal.addEventListener('click', (event) => {
    if (event.target === els.walletModal) {
      toggleWalletModal(false);
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      toggleWalletModal(false);
    }
  });

  els.walletOptions.forEach((option) => {
    option.addEventListener('click', () => {
      connectWallet(option.dataset.wallet);
      toggleWalletModal(false);
    });
  });

  els.disconnectBtn.addEventListener('click', () => {
    disconnectWallet();
  });

  els.fromAmount.addEventListener('input', updateQuotePreview);
  els.fromToken.addEventListener('change', () => {
    ensurePairIntegrity();
    updateFormHints();
    updateQuotePreview();
  });
  els.toToken.addEventListener('change', () => {
    ensurePairIntegrity();
    updateFormHints();
    updateQuotePreview();
  });
  els.flipPair.addEventListener('click', () => {
    const fromValue = els.fromToken.value;
    els.fromToken.value = els.toToken.value;
    els.toToken.value = fromValue;
    ensurePairIntegrity();
    updateFormHints();
    updateQuotePreview();
  });

  els.swapForm.addEventListener('submit', handleSwap);
  els.withdrawTon.addEventListener('click', handleWithdrawTon);
}

function ensurePairIntegrity() {
  if (els.fromToken.value === els.toToken.value) {
    els.toToken.value = els.fromToken.value === 'TON' ? 'USDT' : 'TON';
  }
}

function toggleWalletModal(show) {
  els.walletModal.classList.toggle('hidden', !show);
}

function connectWallet(type) {
  state.connected = true;
  state.walletType = type;
  state.walletAddress = generateAddress();
  state.walletBalances = {
    TON: randomBetween(120, 420, 4),
    USDT: randomBetween(850, 3200, 2),
  };
  state.exchangeBalances = { TON: randomBetween(0, 35, 3), USDT: randomBetween(20, 240, 2) };
  state.lastStatus = `${type} подключён. Адрес ${shortAddress(state.walletAddress)}`;
  state.lastTone = 'success';
  state.lastStatusTime = new Date();
  showToast('Кошелёк подключён', 'success');
  updateHeader();
  updateBalances();
  updateFormHints();
  updateQuotePreview();
  renderStatus();
}

function disconnectWallet() {
  state.connected = false;
  state.walletType = null;
  state.walletAddress = null;
  state.walletBalances = { TON: 0, USDT: 0 };
  state.exchangeBalances = { TON: 0, USDT: 0 };
  state.lastStatus = 'Кошелёк отключён';
  state.lastTone = 'info';
  state.lastStatusTime = new Date();
  showToast('Сессия завершена', 'success');
  updateHeader();
  updateBalances();
  updateFormHints();
  updateQuotePreview();
  renderStatus();
}

function updateHeader() {
  if (!state.connected || !state.walletType) {
    els.walletChip.classList.add('hidden');
    els.disconnectBtn.classList.add('hidden');
    els.openWalletModal.textContent = 'Подключить кошелёк';
    els.openWalletModal.disabled = false;
    return;
  }
  const label = `${state.walletType} · ${shortAddress(state.walletAddress)}`;
  els.walletChip.textContent = label;
  els.walletChip.classList.remove('hidden');
  els.disconnectBtn.classList.remove('hidden');
  els.openWalletModal.textContent = 'Сменить кошелёк';
}

function updateBalances() {
  els.walletTon.textContent = `TON — ${tokenFormat.format(state.walletBalances.TON)}`;
  els.walletUsdt.textContent = `USDT — ${numberFormat.format(state.walletBalances.USDT)}`;
  els.exchangeTon.textContent = `TON — ${tokenFormat.format(state.exchangeBalances.TON)}`;
  els.exchangeUsdt.textContent = `USDT — ${numberFormat.format(state.exchangeBalances.USDT)}`;
  els.withdrawTon.disabled = state.exchangeBalances.TON <= 0;
}

function updateFormHints() {
  const fromToken = els.fromToken.value;
  if (!state.connected) {
    els.fromBalance.textContent = 'Подключите кошелёк, чтобы увидеть доступный баланс';
    return;
  }
  const available = state.walletBalances[fromToken];
  els.fromBalance.textContent = `Доступно — ${formatToken(available, fromToken)} ${fromToken}`;
}

function updateQuotePreview() {
  const amount = parseFloat(els.fromAmount.value.replace(',', '.')) || 0;
  const fromToken = els.fromToken.value;
  const toToken = els.toToken.value;
  if (amount <= 0 || !state.connected) {
    els.toAmount.value = '0.00';
    els.feeInfo.textContent = `Комиссия — ${formatToken(0, toToken)} ${toToken}`;
    return;
  }
  const quote = computeQuote(amount, fromToken, toToken);
  if (!quote) {
    els.toAmount.value = '0.00';
    els.feeInfo.textContent = 'Комиссия — недоступна';
    return;
  }
  els.toAmount.value = formatToken(quote.netReceive, toToken);
  els.feeInfo.textContent = `Комиссия — ${formatToken(quote.fee, toToken)} ${toToken}`;
}

function computeQuote(amount, fromToken, toToken) {
  if (fromToken === toToken) return null;
  const { feePercent, flatFee, rateTonToUsdt } = state;
  if (fromToken === 'TON' && toToken === 'USDT') {
    const gross = amount * rateTonToUsdt;
    const fee = gross * feePercent + flatFee;
    const net = Math.max(gross - fee, 0);
    return { grossReceive: gross, netReceive: net, fee, feeCurrency: 'USDT' };
  }
  if (fromToken === 'USDT' && toToken === 'TON') {
    const gross = amount / rateTonToUsdt;
    const flatTon = flatFee / rateTonToUsdt;
    const fee = gross * feePercent + flatTon;
    const net = Math.max(gross - fee, 0);
    return { grossReceive: gross, netReceive: net, fee, feeCurrency: 'TON' };
  }
  return null;
}

function handleSwap(event) {
  event.preventDefault();
  if (!state.connected) {
    setStatus('Сначала подключите кошелёк', 'error');
    showToast('Нет подключённого кошелька', 'error');
    return;
  }
  const fromToken = els.fromToken.value;
  const toToken = els.toToken.value;
  const amount = parseFloat(els.fromAmount.value.replace(',', '.'));
  if (!amount || amount <= 0) {
    setStatus('Введите сумму обмена', 'error');
    return;
  }
  const available = state.walletBalances[fromToken];
  if (amount > available) {
    setStatus(`Недостаточно ${fromToken} на кошельке`, 'error');
    showToast('Проверьте баланс кошелька', 'error');
    return;
  }
  const quote = computeQuote(amount, fromToken, toToken);
  if (!quote || quote.netReceive <= 0) {
    setStatus('Невозможно рассчитать обмен', 'error');
    return;
  }

  const processingId = Math.random().toString(36).slice(2, 8).toUpperCase();
  simulateNetworkDelay(() => {
    performSwap(fromToken, toToken, amount, quote);
    const message = `Swap ${fromToken}→${toToken} выполнен · ордер ${processingId}`;
    setStatus(message, 'success');
    showToast(`Получено ${formatToken(quote.netReceive, toToken)} ${toToken}`, 'success');
    els.fromAmount.value = '';
    updateQuotePreview();
  });
  setStatus('Операция обрабатывается…', 'info');
}

function performSwap(fromToken, toToken, amount, quote) {
  state.walletBalances[fromToken] -= amount;
  if (fromToken === 'TON') {
    state.exchangeBalances.TON += amount;
    state.exchangeBalances.TON -= amount;
    state.exchangeBalances.USDT += quote.netReceive;
  } else {
    state.exchangeBalances.USDT += amount;
    state.exchangeBalances.USDT -= amount;
    state.exchangeBalances.TON += quote.netReceive;
  }
  const volumeIncrement = fromToken === 'USDT' ? amount : amount * state.rateTonToUsdt;
  state.volume24h += volumeIncrement;
  state.trades += 1;
  state.tradesHourDelta += 1;
  updateBalances();
  updateMetrics();
}

function handleWithdrawTon() {
  if (!state.connected) {
    setStatus('Подключите кошелёк для вывода', 'error');
    showToast('Нет подключённого кошелька', 'error');
    return;
  }
  if (state.exchangeBalances.TON <= 0) {
    setStatus('На счёте MetaSwap нет TON для вывода', 'error');
    return;
  }
  const amount = state.exchangeBalances.TON;
  simulateNetworkDelay(() => {
    state.exchangeBalances.TON = 0;
    state.walletBalances.TON += amount;
    setStatus(`Вывод ${formatToken(amount, 'TON')} TON завершён`, 'success');
    showToast('TON отправлены на ваш кошелёк', 'success');
    updateBalances();
  });
  setStatus('Создаём транзакцию вывода…', 'info');
}

function setStatus(message, tone = 'info') {
  state.lastStatus = message;
  state.lastTone = tone;
  state.lastStatusTime = new Date();
  renderStatus();
}

function renderStatus() {
  els.swapStatus.dataset.tone = state.lastTone;
  els.swapStatusText.textContent = state.lastStatus;
  if (!state.lastStatusTime) {
    els.swapStatusTime.textContent = '';
    return;
  }
  els.swapStatusTime.textContent = `· ${state.lastStatusTime.toLocaleTimeString('ru-RU')}`;
}

function updateRateDisplays() {
  els.rateValue.textContent = `1 TON = ${numberFormat.format(state.rateTonToUsdt)} USDT`;
  els.metricTonUsdt.textContent = `1 TON = ${numberFormat.format(state.rateTonToUsdt)} USDT`;
  const percent = (state.feePercent * 100).toFixed(2);
  els.avgFee.textContent = `${percent}% + ${numberFormat.format(state.flatFee)} USDT`;
  els.metricFee.textContent = `${percent}% + ${numberFormat.format(state.flatFee)} USDT`;
}

function updateMetrics() {
  updateRateDisplays();
  els.volumeValue.textContent = usdFormat.format(state.volume24h);
  els.metricVolume.textContent = usdFormat.format(state.volume24h);
  els.tradesValue.textContent = formatInteger(state.trades);
  els.metricTrades.textContent = formatInteger(state.trades);
  els.hourlyDelta.textContent = `+${formatInteger(state.tradesHourDelta)}`;
  els.metricDelta.textContent = `+${formatInteger(state.tradesHourDelta)} за последний час`;
}

function applyRateDrift() {
  const drift = randomBetween(-0.08, 0.08, 4);
  state.rateTonToUsdt = Math.max(1.4, state.rateTonToUsdt + drift);
  updateRateDisplays();
  updateQuotePreview();
}

function simulateNetworkDelay(callback) {
  const delay = randomBetween(500, 1200);
  setTimeout(callback, delay);
}

function formatToken(value, token) {
  return token === 'USDT' ? numberFormat.format(value) : tokenFormat.format(value);
}

function formatInteger(value) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(value));
}

function generateAddress() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let base = 'EQ';
  for (let i = 0; i < 44; i += 1) {
    base += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return base;
}

function shortAddress(address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function randomBetween(min, max, decimals = 0) {
  const value = Math.random() * (max - min) + min;
  return parseFloat(value.toFixed(decimals));
}

function showToast(message, tone = 'info') {
  els.toast.textContent = message;
  els.toast.dataset.tone = tone;
  els.toast.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    els.toast.classList.add('hidden');
  }, 2800);
}

init();
