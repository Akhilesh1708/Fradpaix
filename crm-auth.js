/* =========================================
   FRADPAIX CRM — Auth (roles: admin / manager)
   Credentials stored in localStorage (browser-local, no server).
   ========================================= */

const CRM_AUTH = (function () {
  const KEYS = {
    session:  'fradpaix-crm-session',   // { role, username, loginAt }
    accounts: 'fradpaix-crm-accounts'   // { admin: hash, manager: hash }
  };

  /* ---- simple hash (not cryptographic — client-side only project) ---- */
  function simpleHash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return h.toString(16);
  }

  /* ---- Default credentials (used on first run) ----
     Admin    : admin / Fradpaix@2026
     Manager  : manager / Trek@manager1
  ---------------------------------------------------------------- */
  const DEFAULTS = {
    admin:   simpleHash('Fradpaix@2026'),
    manager: simpleHash('Trek@manager1')
  };

  function getAccounts() {
    try {
      const stored = JSON.parse(localStorage.getItem(KEYS.accounts));
      return stored && stored.admin ? stored : DEFAULTS;
    } catch { return DEFAULTS; }
  }

  function saveAccounts(obj) {
    localStorage.setItem(KEYS.accounts, JSON.stringify(obj));
  }

  /* ---- Session helpers ---- */
  function getSession() {
    try { return JSON.parse(localStorage.getItem(KEYS.session)); } catch { return null; }
  }

  function setSession(role, username) {
    localStorage.setItem(KEYS.session, JSON.stringify({ role, username, loginAt: Date.now() }));
  }

  function clearSession() {
    localStorage.removeItem(KEYS.session);
  }

  function isLoggedIn() {
    const s = getSession();
    if (!s) return false;
    // Session expires after 8 hours
    return (Date.now() - s.loginAt) < 8 * 60 * 60 * 1000;
  }

  function getRole() {
    return getSession()?.role || null;
  }

  function getUsername() {
    return getSession()?.username || '';
  }

  /* ---- Login ---- */
  function login(role, password) {
    const accounts = getAccounts();
    const hash = simpleHash(password);
    if (accounts[role] === hash) {
      setSession(role, role === 'admin' ? 'Admin' : 'Manager');
      return true;
    }
    return false;
  }

  /* ---- Change password (admin only) ---- */
  function changePassword(role, newPassword) {
    if (!['admin', 'manager'].includes(role)) return false;
    const accounts = getAccounts();
    accounts[role] = simpleHash(newPassword);
    saveAccounts(accounts);
    return true;
  }

  /* ---- Route guards ---- */
  function requireLogin() {
    if (!isLoggedIn()) {
      window.location.replace('crm-login.html');
    }
  }

  function requireAdmin() {
    requireLogin();
    if (getRole() !== 'admin') {
      // Managers are redirected to crm.html, not login
      alert('This action requires Admin access.');
      window.location.replace('crm.html');
    }
  }

  /* ---- Logout ---- */
  function logout() {
    clearSession();
    window.location.assign('crm-login.html');
  }

  /* ---- Init logout buttons ---- */
  function initLogoutButtons() {
    document.querySelectorAll('[data-crm-logout]').forEach(btn => {
      btn.addEventListener('click', logout);
    });
  }

  /* ---- Inject role badge into nav ---- */
  function injectRoleBadge() {
    const nav = document.querySelector('.crm-nav');
    if (!nav) return;
    const role = getRole();
    const username = getUsername();
    const badge = document.createElement('span');
    badge.className = 'crm-role-badge crm-role-badge--' + role;
    badge.textContent = username;
    nav.prepend(badge);
  }

  return {
    requireLogin, requireAdmin,
    logout, initLogoutButtons, injectRoleBadge,
    getRole, getUsername, isLoggedIn, login,
    changePassword,
    // expose for login page
    _initLoginPage: function () {
      const form     = document.getElementById('crm-login-form');
      const errEl    = document.getElementById('crm-login-error');
      const roleSelect = document.getElementById('crm-role');
      if (!form) return;

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const role     = roleSelect ? roleSelect.value : 'admin';
        const password = document.getElementById('crm-password').value;
        if (!password) return;

        if (login(role, password)) {
          window.location.assign('crm.html');
        } else {
          if (errEl) {
            errEl.textContent = 'Incorrect password. Please try again.';
            errEl.style.display = 'block';
          } else {
            alert('Incorrect password.');
          }
          document.getElementById('crm-password').value = '';
          document.getElementById('crm-password').focus();
        }
      });
    }
  };
})();

/* ---- backwards-compat stubs used in existing HTML ---- */
function requireCrmLogin()  { CRM_AUTH.requireLogin(); }
function initCrmLogin()     { CRM_AUTH._initLoginPage(); }
function initCrmLogout()    { CRM_AUTH.initLogoutButtons(); CRM_AUTH.injectRoleBadge(); }
