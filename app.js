/* WA Private — app.js
   - Firebase auth (email / google / phone)
   - Random +29 app number per user stored in Firestore
   - Create chat documents and real-time messages
   - Basic UI wiring: tabs, contacts, composer, settings
   - Placeholders: Agora calls + hidden feature uploads
*/

/* ---------- Firebase init (your keys) ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyAgpZoF0BPCGmIKXvE9hRTb4cVJfiFjMGk",
  authDomain: "whatsapp-private-2a489.firebaseapp.com",
  projectId: "whatsapp-private-2a489",
  storageBucket: "whatsapp-private-2a489.firebasestorage.app",
  messagingSenderId: "334440521979",
  appId: "1:334440521979:web:0766fe70462cab7cbc505e"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

/* ---------- helpers ---------- */
const $ = id => document.getElementById(id);
const show = el => el.classList.remove('hidden');
const hide = el => el.classList.add('hidden');

let me = null;
let currentChatId = null;
let messageListener = null;
let hiddenUnlocked = false;

/* ---------- UI references ---------- */
const authScreen = $('auth');
const appScreen = $('app');
const signupBtn = $('signupBtn');
const loginBtn = $('loginBtn');
const googleBtn = $('googleBtn');
const sendOtpBtn = $('sendOtpBtn');
const verifyOtpBtn = $('verifyOtpBtn');
const otpInput = $('otpInput');
const phoneInput = $('phoneNumber');

const myAvatar = $('myAvatar');
const myName = $('myName');
const myAppNumberEl = $('myAppNumber');
const openSettingsBtn = $('openSettingsBtn');
const signOutBtn = $('signOutBtn');

const tabs = Array.from(document.querySelectorAll('.tab'));
const tabPanes = { chats: $('tab-chats'), status: $('tab-status'), calls: $('tab-calls') };

const chatsList = $('chatsList');
const messagesEl = $('messages');
const chatHeader = $('chatHeader');
const contactNumberInput = $('contactNumberInput');
const addContactBtn = $('addContactBtn');
const messageInput = $('messageInput');
const sendMsgBtn = $('sendMsgBtn');

const settingsPanel = $('settingsPanel');
const closeSettingsBtn = $('closeSettingsBtn');
const saveSettingsBtn = $('saveSettingsBtn');
const displayNameInput = $('displayName');
const profilePicFile = $('profilePicFile');
const privacyBtn = $('privacyBtn');

const hiddenToolbar = $('hiddenToolbar');
const hiddenVoiceFile = $('hiddenVoiceFile');
const hiddenVideoFile = $('hiddenVideoFile');
const unlockSwapBtn = $('unlockSwapBtn');

const subscriptionModal = $('subscriptionModal');
const closeSubscriptionBtn = $('closeSubscriptionBtn');
const payButtons = Array.from(document.querySelectorAll('.pay'));

/* ---------- Auth: Email signup/login ---------- */
signupBtn.addEventListener('click', async () => {
  const email = $('emailInput').value.trim();
  const pw = $('passwordInput').value.trim();
  if (!email || !pw) return alert('Enter email & password');
  try {
    const res = await auth.createUserWithEmailAndPassword(email, pw);
    // create user doc if not exists
    const appNumber = generateAppNumber();
    await db.collection('users').doc(res.user.uid).set({
      email, appNumber, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    // open app
    // openAppForUser will be triggered by onAuthStateChanged
  } catch (err) { alert(err.message) }
});

loginBtn.addEventListener('click', async () => {
  const email = $('emailInput').value.trim();
  const pw = $('passwordInput').value.trim();
  if (!email || !pw) return alert('Enter email & password');
  try {
    await auth.signInWithEmailAndPassword(email, pw);
  } catch (err) { alert(err.message) }
});

/* Google sign-in */
googleBtn.addEventListener('click', async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const res = await auth.signInWithPopup(provider);
    // ensure user doc
    const doc = await db.collection('users').doc(res.user.uid).get();
    if (!doc.exists) {
      const appNumber = generateAppNumber();
      await db.collection('users').doc(res.user.uid).set({
        email: res.user.email, appNumber, createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch (err) { alert(err.message) }
});

/* Phone OTP (requires hosting / HTTPS) */
window.recaptchaVerifier = null;
function setupRecaptcha() {
  if (window.recaptchaVerifier) return;
  window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {size: 'invisible'});
  window.recaptchaVerifier.render();
}
setupRecaptcha();

sendOtpBtn.addEventListener('click', async () => {
  const phone = phoneInput.value.trim();
  if (!phone) return alert('Enter phone with country code');
  try {
    const confirmation = await auth.signInWithPhoneNumber(phone, window.recaptchaVerifier);
    window._confirmationResult = confirmation;
    alert('OTP sent to ' + phone);
  } catch (err) { alert(err.message); window.recaptchaVerifier.clear(); setupRecaptcha(); }
});

verifyOtpBtn.addEventListener('click', async () => {
  const code = otpInput.value.trim();
  if (!code || !window._confirmationResult) return alert('No OTP or result');
  try {
    const res = await window._confirmationResult.confirm(code);
    // ensure user doc
    const doc = await db.collection('users').doc(res.user.uid).get();
    if (!doc.exists) {
      const appNumber = generateAppNumber();
      await db.collection('users').doc(res.user.uid).set({phone: res.user.phoneNumber, appNumber, createdAt: firebase.firestore.FieldValue.serverTimestamp()});
    }
  } catch (err) { alert(err.message) }
});

/* sign out */
signOutBtn.addEventListener('click', async () => {
  await auth.signOut();
  location.reload();
});

/* ---------- onAuth state ---------- */
auth.onAuthStateChanged(async (user) => {
  if (user) {
    me = user;
    await openAppForUser(user);
  } else {
    // show auth
    authScreen.style.display = 'block';
    appScreen.style.display = 'none';
  }
});

/* ---------- utilities ---------- */
function generateAppNumber(){
  return '+29' + Math.floor(100000000 + Math.random() * 900000000);
}

/* open app for signed user */
async function openAppForUser(user){
  authScreen.style.display = 'none';
  appScreen.style.display = 'block';
  // fetch user doc
  const doc = await db.collection('users').doc(user.uid).get();
  const data = doc.exists ? doc.data() : {};
  myName.innerText = data.displayName || user.displayName || 'WA Private';
  myAppNumberEl.innerText = data.appNumber || data.phone || '+29XXXXXXXXX';
  $('myNumberView').innerText = data.appNumber || data.phone || '+29XXXXXXXXX';
  // load chats
  loadChats();
  // start default view: chats
  setActiveTab('chats');
  // check trial/subscription
  checkTrial(user.uid);
}

/* ---------- tabs ---------- */
tabs.forEach(t => t.addEventListener('click', ()=> setActiveTab(t.dataset.tab)));
function setActiveTab(tab){
  tabs.forEach(b=>b.classList.toggle('active', b.dataset.tab === tab));
  Object.keys(tabPanes).forEach(k => tabPanes[k].classList.toggle('hidden', k !== tab));
}

/* ---------- chats: create / list / open ---------- */
addContactBtn.addEventListener('click', async () => {
  const appNum = contactNumberInput.value.trim();
  if (!appNum) return alert('Enter app number to add');
  // find user by appNumber
  const q = await db.collection('users').where('appNumber', '==', appNum).get();
  if (q.empty) return alert('No user with that app number');
  const otherUid = q.docs[0].id;
  // create chat doc if not exists: naive approach, search for chats containing both
  const candidate = await db.collection('chats').where('participants', 'array-contains', me.uid).get();
  let existsId = null;
  for (const d of candidate.docs){
    const parts = d.data().participants || [];
    if (parts.includes(otherUid) && parts.length === 2) { existsId = d.id; break; }
  }
  if (!existsId) {
    const chatRef = await db.collection('chats').add({participants: [me.uid, otherUid], createdAt: firebase.firestore.FieldValue.serverTimestamp(), lastMessage: ''});
    existsId = chatRef.id;
  }
  contactNumberInput.value = '';
  openChat(existsId);
});

/* load chat list */
async function loadChats(){
  chatsList.innerHTML = '<div class="muted small">Loading...</div>';
  const q = await db.collection('chats').where('participants', 'array-contains', me.uid).orderBy('createdAt','desc').get();
  chatsList.innerHTML = '';
  if (q.empty) { chatsList.innerHTML = '<div class="muted small">No chats</div>'; return; }
  q.forEach(async doc => {
    const c = doc.data();
    const other = c.participants.find(x=>x !== me.uid);
    const ud = await db.collection('users').doc(other).get();
    const name = ud.exists ? (ud.data().displayName || ud.data().email || ud.data().appNumber) : other;
    const item = document.createElement('div');
    item.className = 'contact';
    item.innerHTML = `<div class="avatar"></div><div class="meta"><div class="name">${name}</div><div class="last muted">${c.lastMessage || ''}</div></div>`;
    item.onclick = ()=> openChat(doc.id);
    chatsList.appendChild(item);
  });
}

/* open chat and listen messages */
async function openChat(chatId){
  currentChatId = chatId;
  messagesEl.innerHTML = '<div class="muted small">Loading messages...</div>';
  // remove previous listener
  if (messageListener) messageListener();
  const chatDoc = await db.collection('chats').doc(chatId).get();
  if (!chatDoc.exists) return alert('Chat missing');
  const participants = chatDoc.data().participants;
  const otherUid = participants.find(p => p !== me.uid);
  const otherDoc = await db.collection('users').doc(otherUid).get();
  const other = otherDoc.exists ? otherDoc.data() : {appNumber: otherUid};
  chatHeader.innerText = other.displayName || other.email || other.appNumber;
  // listen messages
  const q = db.collection('chats').doc(chatId).collection('messages').orderBy('createdAt');
  messageListener = q.onSnapshot(snapshot => {
    messagesEl.innerHTML = '';
    snapshot.forEach(doc => {
      const m = doc.data();
      const el = document.createElement('div');
      el.className = 'message ' + (m.from === me.uid ? 'me' : 'them');
      el.innerHTML = `<div>${escapeHtml(m.text || '')}</div><div class="msg-time">${m.createdAt ? new Date(m.createdAt.toDate()).toLocaleTimeString() : ''}</div>`;
      messagesEl.appendChild(el);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

/* send message */
sendMsgBtn.addEventListener('click', async () => {
  const txt = messageInput.value.trim();
  if (!txt) return;
  if (!currentChatId) return alert('Select a chat first');
  await db.collection('chats').doc(currentChatId).collection('messages').add({
    text: txt, from: me.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  await db.collection('chats').doc(currentChatId).update({lastMessage: txt, lastUpdated: firebase.firestore.FieldValue.serverTimestamp()});
  messageInput.value = '';
});

/* composer enter key */
messageInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendMsgBtn.click(); });

/* ---------- settings actions ---------- */
openSettingsBtn.addEventListener('click', () => settingsPanel.classList.toggle('hidden'));
closeSettingsBtn.addEventListener('click', () => settingsPanel.classList.add('hidden'));
saveSettingsBtn.addEventListener('click', async () => {
  const name = displayNameInput.value.trim();
  if (!me) return alert('Not signed');
  await db.collection('users').doc(me.uid).update({displayName: name});
  myName.innerText = name || myName.innerText;
  alert('Saved');
});

/* ---------- privacy hidden features unlock ---------- */
let privacyTap = 0;
privacyBtn.addEventListener('click', () => {
  privacyTap++;
  if (privacyTap >= 7) {
    const pass = prompt('Enter activation password');
    if (pass === 'DANNYX') {
      hiddenUnlocked = true;
      hiddenToolbar.classList.remove('hidden');
      alert('Hidden features unlocked (verified)');
      awaitMarkHiddenUnlocked();
    } else alert('Wrong password');
    privacyTap = 0;
  }
});

async function awaitMarkHiddenUnlocked(){
  if (!me) return;
  await db.collection('users').doc(me.uid).update({hiddenUnlocked:true});
}

/* uploads in hidden toolbar */
hiddenVoiceFile.addEventListener('change', e => {
  if (!e.target.files[0]) return;
  alert('Voice selected: ' + e.target.files[0].name + ' (local preview only)');
});
hiddenVideoFile.addEventListener('change', e => {
  if (!e.target.files[0]) return;
  alert('Video/face selected: ' + e.target.files[0].name + ' (local preview only)');
});

/* toggle swap (placeholder) */
unlockSwapBtn.addEventListener('click', () => {
  if (!hiddenUnlocked) return alert('Unlock hidden features first');
  alert('Swap toggled (placeholder). Real-time swap needs server-side AI + Agora integration.');
});

/* ---------- calls (placeholder using Agora) ---------- */
$('startCallBtn')?.addEventListener('click', () => {
  const target = $('callWithNumber').value.trim();
  if (!target) return alert('Enter app number to call');
  alert('Starting call to ' + target + ' (Agora integration placeholder).');
  // here: join Agora channel, publish local tracks, subscribe remote
});

/* ---------- trial & subscription ---------- */
async function checkTrial(uid){
  const doc = await db.collection('users').doc(uid).get();
  const data = doc.exists ? doc.data() : {};
  if (data.hiddenUnlocked) return;
  if (!data.trialEnd) {
    const trialEnd = Date.now() + 7*24*60*60*1000;
    await db.collection('users').doc(uid).update({trialEnd});
    $('trialText').innerText = 'Trial active: 7 days';
    return;
  }
  if (Date.now() > data.trialEnd) {
    // show subscription modal
    subscriptionModal.classList.remove('hidden');
    appScreen.classList.add('hidden');
  } else {
    const days = Math.ceil((data.trialEnd - Date.now())/(1000*60*60*24));
    $('trialText').innerText = 'Trial active: ' + days + ' days left';
  }
}
closeSubscriptionBtn.addEventListener('click', () => { subscriptionModal.classList.add('hidden'); appScreen.classList.remove('hidden'); });
payButtons.forEach(b=>{
  b.addEventListener('click', async (e)=>{
    const plan = e.target.getAttribute('data-plan') || '1m';
    alert('Payment placeholder for plan ' + plan + '. Implement Stripe/crypto flow to collect money.');
    await db.collection('users').doc(me.uid).update({subscribed:true, subscriptionPlan:plan});
    subscriptionModal.classList.add('hidden'); appScreen.classList.remove('hidden');
  });
});

/* ---------- utility & escape HTML ---------- */
function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ---------- onAuth open app (listener) ---------- */
async function openAppForUser(user){
  me = user;
  // fetch user doc
  const doc = await db.collection('users').doc(user.uid).get();
  const data = doc.exists ? doc.data() : {};
  myName.innerText = data.displayName || user.displayName || 'WA Private';
  myAppNumberEl.innerText = data.appNumber || data.phone || '+29' + Math.floor(100000000+Math.random()*900000000);
  $('myNumberView').innerText = myAppNumberEl.innerText;
  // load chats
  loadChats();
  // check trial
  checkTrial(user.uid);
}

/* ---------- initial: if already signed in ---------- */
if (auth.currentUser) openAppForUser(auth.currentUser);