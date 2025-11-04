window.addEventListener('DOMContentLoaded', () => {
  if (typeof TonConnect === 'undefined') {
    console.error('❌ TonConnect SDK не найден. Проверь подключение скрипта.');
    return;
  }

  // === основной код TonConnect ===
  const tonConnect = new TonConnect({
    manifestUrl: "https://ment345.github.io/metaswapOld/tonconnect-manifest.json"
  });

  console.log('✅ TonConnect SDK инициализирован');
  
  // дальше твой код подключения кошелька
});

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
  extraNativeBalance: null,
  lastConnectedChainId: null,
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

let tonConnect = null;
let evmProvider = null;
let evmProviderType = null;
let evmAccount = null;
let manualDisconnect = false;

function init() {
  els.year.textContent = new Date().getFullYear();
  setupEvents();
  initTonConnect();
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
    option.addEventListener('click', async () => {
      toggleWalletModal(false);
      await connectWallet(option.dataset.wallet);
    });
  });

  els.disconnectBtn.addEventListener('click', async () => {
    await disconnectWallet();
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

async function initTonConnect() {
  if (tonConnect || !window.TON_CONNECT) {
    return;
  }
  try {
    const manifestUrl = resolveManifestUrl();
    tonConnect = new window.TON_CONNECT.TonConnect({ manifestUrl });
    tonConnect.onStatusChange(handleTonStatusChange);
    await tonConnect.restoreConnection();
  } catch (error) {
    console.error('TonConnect init failed', error);
  }
}

function resolveManifestUrl() {
  try {
    const baseHref = window.location.href || `${window.location.origin}/`;
    const url = new URL('tonconnect-manifest.json', baseHref);
    return url.toString();
  } catch (error) {
    console.error('resolveManifestUrl', error);
  }
  return 'https://metaswap.example/tonconnect-manifest.json';
}

async function connectTonKeeper() {
  if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') {
    throw new Error('TonKeeper требует запуска сайта по HTTPS или через публичный домен');
  }
  if (!tonConnect) {
    throw new Error('TonConnect SDK не инициализирован');
  }
  if (state.connected && state.walletType === 'TonKeeper') {
    showToast('TonKeeper уже подключён', 'info');
    return;
  }
  setStatus('Ожидаем подтверждение в TonKeeper…', 'info');
  showToast('Подтвердите запрос в TonKeeper', 'info');
  const wallets = await tonConnect.getWallets();
  const tonkeeper = wallets.find((wallet) => /tonkeeper/i.test(wallet.name));
  const connectionSource = tonkeeper
    ? { universalLink: tonkeeper.universalLink, bridgeUrl: tonkeeper.bridgeUrl }
    : { universalLink: 'https://app.tonkeeper.com/ton-connect', bridgeUrl: 'https://bridge.tonapi.io/bridge' };
  await tonConnect.connect(connectionSource);
}

async function handleTonStatusChange(walletInfo) {
  if (!walletInfo) {
    if (state.walletType === 'TonKeeper' || manualDisconnect) {
      const notify = manualDisconnect || state.connected;
      applyDisconnected({
        notify,
        message: 'TonKeeper отключён',
        tone: manualDisconnect ? 'success' : 'info',
        toast: manualDisconnect ? 'Сессия завершена' : 'TonKeeper отключён',
      });
      manualDisconnect = false;
    }
    return;
  }
  const address = walletInfo.account?.address || walletInfo.account?.address?.toString() || '';
  const tonBalance = await fetchTonBalance(address);
  if (tonBalance === null) {
    showToast('Не удалось получить баланс TON', 'info');
  }
  applyConnection({
    type: 'TonKeeper',
    address,
    balances: { TON: tonBalance ?? 0, USDT: 0 },
    status: `TonKeeper подключён. Адрес ${shortAddress(address)}`,
    tone: 'success',
    toast: 'TonKeeper подключён',
  });
}

async function fetchTonBalance(address) {
  if (!address) {
    return 0;
  }
  try {
    const response = await fetch(`https://tonapi.io/v2/accounts/${address}`);
    if (!response.ok) {
      return null;
    }
    const payload = await response.json();
    const balanceCandidate =
      payload.balance ?? payload.account?.balance ?? payload.result?.balance ?? null;
    if (balanceCandidate === null || balanceCandidate === undefined) {
      return null;
    }
    const bigintValue = typeof balanceCandidate === 'string' ? BigInt(balanceCandidate) : BigInt(balanceCandidate);
    return Number(bigintValue) / 1_000_000_000;
  } catch (error) {
    console.error('fetchTonBalance', error);
    return null;
  }
}

async function connectEvmWallet(type) {
  const provider = getEvmProvider(type);
  if (!provider) {
    throw new Error(`${type} недоступен в этом браузере. Установите расширение или откройте dApp внутри кошелька.`);
  }
  if (state.connected && state.walletType === type && evmAccount) {
    showToast(`${type} уже подключён`, 'info');
    return;
  }
  evmProvider = provider;
  evmProviderType = type;
  bindEvmEvents(provider);
  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  if (!accounts || accounts.length === 0) {
    throw new Error('Кошелёк не вернул адреса аккаунтов');
  }
  evmAccount = accounts[0];
  const chainId = await provider.request({ method: 'eth_chainId' });
  state.lastConnectedChainId = chainId;
  const contractMeta = getUsdtContract(chainId);
  const [nativeBalance, usdtBalance] = await Promise.all([
    fetchEvmNativeBalance(provider, evmAccount),
    fetchUsdtBalance(provider, evmAccount, chainId),
  ]);
  state.extraNativeBalance = nativeBalance;
  applyConnection({
    type,
    address: evmAccount,
    balances: { TON: 0, USDT: usdtBalance ?? 0 },
    status: `${type} подключён. Адрес ${shortAddress(evmAccount)}`,
    tone: 'success',
    toast: `${type} подключён`,
  });
  if (!contractMeta) {
    showToast('Добавьте адрес контракта USDT для текущей сети', 'info');
  }
}

function getEvmProvider(type) {
  const { ethereum } = window;
  if (!ethereum) {
    return null;
  }
  if (ethereum.providers && Array.isArray(ethereum.providers)) {
    const match = ethereum.providers.find((provider) => {
      if (type === 'MetaMask') {
        return provider.isMetaMask;
      }
      if (type === 'Trust Wallet') {
        return provider.isTrust || provider.isTrustWallet;
      }
      return false;
    });
    if (match) {
      return match;
    }
  }
  if (type === 'MetaMask' && ethereum.isMetaMask) {
    return ethereum;
  }
  if (type === 'Trust Wallet' && (ethereum.isTrust || ethereum.isTrustWallet)) {
    return ethereum;
  }
  return ethereum;
}

function bindEvmEvents(provider) {
  unbindEvmEvents();
  if (provider && provider.on) {
    provider.on('accountsChanged', handleEvmAccountsChanged);
    provider.on('disconnect', handleEvmDisconnect);
  }
}

function unbindEvmEvents() {
  if (evmProvider && evmProvider.removeListener) {
    evmProvider.removeListener('accountsChanged', handleEvmAccountsChanged);
    evmProvider.removeListener('disconnect', handleEvmDisconnect);
  }
}

async function handleEvmAccountsChanged(accounts) {
  if (!accounts || accounts.length === 0) {
    evmAccount = null;
    applyDisconnected({
      notify: true,
      message: `${evmProviderType || 'Кошелёк'} отключён`,
      tone: 'info',
      toast: `${evmProviderType || 'Кошелёк'} отключён`,
    });
    return;
  }
  evmAccount = accounts[0];
  try {
    const previousChain = state.lastConnectedChainId;
    const chainId = await evmProvider.request({ method: 'eth_chainId' });
    const contractMeta = getUsdtContract(chainId);
    state.lastConnectedChainId = chainId;
    const usdtBalance = await fetchUsdtBalance(evmProvider, evmAccount, chainId);
    state.walletAddress = evmAccount;
    state.walletBalances.TON = 0;
    state.walletBalances.USDT = usdtBalance ?? 0;
    state.lastStatus = `${evmProviderType || 'Кошелёк'} обновлён. Адрес ${shortAddress(evmAccount)}`;
    state.lastTone = 'info';
    state.lastStatusTime = new Date();
    updateHeader();
    updateBalances();
    updateFormHints();
    updateQuotePreview();
    renderStatus();
    showToast('Адрес кошелька обновлён', 'info');
    if (!contractMeta && chainId !== previousChain) {
      showToast('Добавьте адрес контракта USDT для текущей сети', 'info');
    }
  } catch (error) {
    console.error('handleEvmAccountsChanged', error);
  }
}

function handleEvmDisconnect() {
  applyDisconnected({
    notify: true,
    message: `${evmProviderType || 'Кошелёк'} отключён`,
    tone: 'info',
    toast: `${evmProviderType || 'Кошелёк'} отключён`,
  });
  evmProviderType = null;
  evmAccount = null;
}

async function fetchEvmNativeBalance(provider, address) {
  try {
    const balanceHex = await provider.request({ method: 'eth_getBalance', params: [address, 'latest'] });
    return hexToDecimal(balanceHex, 18);
  } catch (error) {
    console.error('fetchEvmNativeBalance', error);
    return null;
  }
}

async function fetchUsdtBalance(provider, address, chainId) {
  const contract = getUsdtContract(chainId);
  if (!contract) {
    return null;
  }
  try {
    const data = buildBalanceOfData(address);
    const balanceHex = await provider.request({
      method: 'eth_call',
      params: [
        {
          to: contract.address,
          data,
        },
        'latest',
      ],
    });
    return hexToDecimal(balanceHex, contract.decimals);
  } catch (error) {
    console.error('fetchUsdtBalance', error);
    return null;
  }
}

function getUsdtContract(chainId) {
  const normalized = chainId ? chainId.toLowerCase() : '';
  const map = {
    '0x1': { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    '0x38': { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
    '0x89': { address: '0xC2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
    '0xa4b1': { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
    '0xa86a': { address: '0x9702230A8Ea53601f5Cd2dc00fDbc13d4dF4A8c7', decimals: 6 },
  };
  return map[normalized] || null;
}

function buildBalanceOfData(address) {
  const cleaned = address.replace(/^0x/, '').toLowerCase();
  return `0x70a08231${cleaned.padStart(64, '0')}`;
}

function hexToDecimal(hexValue, decimals) {
  if (!hexValue || hexValue === '0x') {
    return 0;
  }
  try {
    const value = BigInt(hexValue);
    const base = BigInt(10) ** BigInt(decimals);
    const whole = value / base;
    const fraction = value % base;
    return Number(whole) + Number(fraction) / Number(base);
  } catch (error) {
    console.error('hexToDecimal', error);
    return 0;
  }
}

function applyConnection({ type, address, balances, status, tone = 'success', toast }) {
  state.connected = true;
  state.walletType = type;
  state.walletAddress = address;
  state.walletBalances = {
    TON: balances?.TON ?? 0,
    USDT: balances?.USDT ?? 0,
  };
  if (status) {
    state.lastStatus = status;
    state.lastTone = tone;
    state.lastStatusTime = new Date();
  }
  updateHeader();
  updateBalances();
  updateFormHints();
  updateQuotePreview();
  renderStatus();
  if (toast !== false) {
    const message = typeof toast === 'string' ? toast : 'Кошелёк подключён';
    showToast(message, tone);
  }
}

function applyDisconnected({ notify = true, message = 'Кошелёк отключён', tone = 'info', toast } = {}) {
  if (state.walletType === 'Trust Wallet' || state.walletType === 'MetaMask' || evmProviderType) {
    unbindEvmEvents();
    evmProviderType = null;
    evmAccount = null;
  }
  state.connected = false;
  state.walletType = null;
  state.walletAddress = null;
  state.walletBalances = { TON: 0, USDT: 0 };
  state.exchangeBalances = { TON: 0, USDT: 0 };
  state.extraNativeBalance = null;
  state.lastConnectedChainId = null;
  state.lastStatus = message;
  state.lastTone = tone;
  state.lastStatusTime = new Date();
  manualDisconnect = false;
  updateHeader();
  updateBalances();
  updateFormHints();
  updateQuotePreview();
  renderStatus();
  if (notify) {
    const toastMessage = typeof toast === 'string' ? toast : message;
    showToast(toastMessage, tone);
  }
}

async function connectWallet(type) {
  try {
    if (type === 'TonKeeper') {
      await connectTonKeeper();
      return;
    }
    if (type === 'Trust Wallet' || type === 'MetaMask') {
      await connectEvmWallet(type);
      return;
    }
    showToast('Этот кошелёк пока не поддерживается', 'error');
  } catch (error) {
    console.error('connectWallet', error);
    let message =
      error && typeof error.message === 'string'
        ? error.message
        : 'Не удалось подключить кошелёк';
    if (error && typeof error.message === 'string' && /reject|cancel/i.test(error.message)) {
      message = 'Подключение отменено пользователем';
    }
    if (typeof error?.code === 'number' && error.code === 300) {
      message = 'Подключение отменено пользователем';
    }
    setStatus(message, 'error');
    showToast(message, 'error');
  }
}

async function disconnectWallet() {
  if (!state.connected) {
    return;
  }
  if (state.walletType === 'TonKeeper' && tonConnect) {
    manualDisconnect = true;
    try {
      await tonConnect.disconnect();
    } catch (error) {
      console.error('TonConnect disconnect', error);
      manualDisconnect = false;
      applyDisconnected({
        notify: true,
        message: 'TonKeeper отключён',
        tone: 'info',
        toast: 'TonKeeper отключён',
      });
    }
    return;
  }
  applyDisconnected({
    notify: true,
    message: 'Сессия завершена',
    tone: 'success',
    toast: 'Сессия завершена',
  });
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

function shortAddress(address) {
  if (!address) {
    return '';
  }
  if (address.length <= 10) {
    return address;
  }
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
