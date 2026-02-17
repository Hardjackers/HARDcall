import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, signInAnonymously, EmailAuthProvider, linkWithCredential, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, push, onChildAdded, onDisconnect, serverTimestamp, remove, get, onValue, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCUi-rXHv_Kxe4ePQmXfeVPN-P6RktV5Ok",
    authDomain: "hardcall-501d4.firebaseapp.com",
    projectId: "hardcall-501d4",
    storageBucket: "hardcall-501d4.firebasestorage.app",
    messagingSenderId: "511926914035",
    appId: "1:511926914035:web:7c8540f3a5f95027006086"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let currentRoom = null;
let roomKey = null;
let userStatusRef = null;
let replyingTo = null;
let targetRoomForPass = null;
let isGuest = false;
let isMuted = localStorage.getItem('hardcall_mute') === 'true';
let connectionTime = 0;

const screens = {
    login: document.getElementById('login-screen'),
    setup: document.getElementById('setup-screen'),
    lobby: document.getElementById('lobby-screen'),
    chat: document.getElementById('chat-screen')
};

const muteCheckbox = document.getElementById('check-mute-sound');
muteCheckbox.checked = isMuted;
muteCheckbox.addEventListener('change', () => {
    isMuted = muteCheckbox.checked;
    localStorage.setItem('hardcall_mute', isMuted);
});

function playSound(type) {
    if (isMuted) return;
    const audio = document.getElementById('sfx-' + type);
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => {});
    }
}

document.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => playSound('click'));
});

function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active', 'hidden'));
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[screenName].classList.remove('hidden');
    screens[screenName].classList.add('active');

    const footer = document.getElementById('main-footer');
    if (screenName === 'chat') {
        footer.classList.add('hidden');
    } else {
        footer.classList.remove('hidden');
    }
}

function showCustomAlert(title, msg) {
    const modal = document.getElementById('custom-modal');
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-msg').innerText = msg;
    document.getElementById('modal-btn-cancel').classList.add('hidden');
    modal.classList.remove('hidden');
    document.getElementById('modal-btn-ok').onclick = () => { modal.classList.add('hidden'); };
}

function showCustomConfirm(title, msg, callback) {
    const modal = document.getElementById('custom-modal');
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-msg').innerText = msg;
    document.getElementById('modal-btn-cancel').classList.remove('hidden');
    modal.classList.remove('hidden');
    document.getElementById('modal-btn-ok').onclick = () => { modal.classList.add('hidden'); callback(true); };
    document.getElementById('modal-btn-cancel').onclick = () => { modal.classList.add('hidden'); callback(false); };
}

function showSuccessModal(msg) {
    const modal = document.getElementById('success-modal');
    document.getElementById('success-msg').innerText = msg;
    modal.classList.remove('hidden');
    document.getElementById('btn-success-ok').onclick = () => { modal.classList.add('hidden'); };
}

document.getElementById('btn-open-legal').addEventListener('click', () => {
    document.getElementById('legal-modal').classList.remove('hidden');
});
document.getElementById('btn-close-legal').addEventListener('click', () => {
    document.getElementById('legal-modal').classList.add('hidden');
});

function setupEnterKey(inputIds, buttonId) {
    inputIds.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    document.getElementById(buttonId).click();
                }
            });
        }
    });
}

setupEnterKey(['guest-room-code', 'guest-room-pass'], 'btn-guest-enter'); 
setupEnterKey(['login-email-input', 'login-pass-input'], 'btn-confirm-email-login');
setupEnterKey(['setup-nickname'], 'btn-save-setup');
setupEnterKey(['create-room-code', 'create-room-pass'], 'btn-create-room');
setupEnterKey(['join-room-code', 'join-room-pass'], 'btn-join-room');
setupEnterKey(['guest-nickname-input'], 'btn-confirm-guest-nick');
setupEnterKey(['new-room-pass'], 'btn-confirm-pass');
setupEnterKey(['link-password-input'], 'btn-link-password');
setupEnterKey(['edit-nickname-input'], 'btn-update-nick');

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && currentRoom) {
        leaveRoom();
    }
});

document.getElementById('btn-google-login').addEventListener('click', () => {
    isGuest = false;
    signInWithPopup(auth, provider).catch((error) => showCustomAlert("Erro Login", error.message));
});

document.getElementById('btn-email-login-open').addEventListener('click', () => {
    document.getElementById('email-login-modal').classList.remove('hidden');
});
document.getElementById('btn-cancel-email-login').addEventListener('click', () => {
    document.getElementById('email-login-modal').classList.add('hidden');
});
document.getElementById('btn-confirm-email-login').addEventListener('click', () => {
    const email = document.getElementById('login-email-input').value;
    const pass = document.getElementById('login-pass-input').value;
    isGuest = false;
    signInWithEmailAndPassword(auth, email, pass)
        .then(() => { document.getElementById('email-login-modal').classList.add('hidden'); })
        .catch((error) => showCustomAlert("Erro", "Falha no acesso. Verifique credenciais."));
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const savedRoom = sessionStorage.getItem('hardcall_room');
        const savedKey = sessionStorage.getItem('hardcall_key');

        if (user.isAnonymous && !isGuest && !savedRoom) {
            signOut(auth);
            return;
        }

        currentUser = user;
        
        if (savedRoom && savedKey) {
            enterRoom(savedRoom, savedKey);
        } else {
            if(user.isAnonymous) { isGuest = true; } 
            else { checkFirstTimeSetup(user); }
        }
    } else {
        showScreen('login');
    }
});

async function checkFirstTimeSetup(user) {
    const userRef = ref(db, 'users/' + user.uid);
    const snapshot = await get(userRef);
    if (snapshot.exists()) {
        const data = snapshot.val();
        currentUser.nickname = data.nickname;
        currentUser.lastNickChange = data.lastNickChange || 0;
        startLobby();
    } else {
        showScreen('setup');
        document.getElementById('setup-nickname').value = user.displayName ? user.displayName.split(' ')[0] : '';
    }
}

let guestTempRoom = null;
let guestTempPass = null;

document.getElementById('btn-guest-enter').addEventListener('click', () => {
    const code = document.getElementById('guest-room-code').value.toUpperCase();
    const pass = document.getElementById('guest-room-pass').value;
    if(!code) return showCustomAlert("Erro", "Digite o nome da sala temporária.");
    guestTempRoom = code;
    guestTempPass = pass;
    isGuest = true;
    signOut(auth).then(() => { return signInAnonymously(auth); })
    .then(() => { document.getElementById('guest-nick-modal').classList.remove('hidden'); })
    .catch((error) => showCustomAlert("Erro Convidado", error.message));
});

document.getElementById('btn-confirm-guest-nick').addEventListener('click', () => {
    const nick = document.getElementById('guest-nickname-input').value;
    if(nick.length < 3) return showCustomAlert("Erro", "Nick muito curto.");
    currentUser.nickname = nick;
    document.getElementById('guest-nick-modal').classList.add('hidden');
    document.getElementById('temp-warning-modal').classList.remove('hidden');
});

document.getElementById('btn-temp-ok').addEventListener('click', () => {
    document.getElementById('temp-warning-modal').classList.add('hidden');
    checkAndEnterGuestRoom();
});

async function checkAndEnterGuestRoom() {
    const roomRef = ref(db, 'rooms/' + guestTempRoom);
    const roomSnap = await get(roomRef);
    if (!roomSnap.exists()) {
        const passHash = CryptoJS.SHA256(guestTempPass).toString();
        await set(roomRef, {
            createdAt: serverTimestamp(),
            config: { isEphemeral: true, passHash: passHash, ownerId: 'GUEST' }
        });
    }
    enterRoom(guestTempRoom, guestTempPass);
}

document.getElementById('btn-logout').addEventListener('click', () => {
    if (currentRoom) leaveRoom();
    signOut(auth);
    location.reload();
});

document.getElementById('btn-save-setup').addEventListener('click', async () => {
    const nick = document.getElementById('setup-nickname').value;
    saveNickname(nick, true);
});

async function saveNickname(nick, isSetup) {
    if (nick.length < 3) return showCustomAlert("Erro", "Nick curto.");
    if (!isSetup && !isGuest) {
        const now = Date.now();
        const lastChange = currentUser.lastNickChange || 0;
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        if (now - lastChange < sevenDaysMs) {
            const daysLeft = Math.ceil((sevenDaysMs - (now - lastChange)) / (1000 * 60 * 60 * 24));
            const errorMsg = document.getElementById('nick-error-msg');
            errorMsg.innerText = `Aguarde ${daysLeft} dias.`;
            errorMsg.classList.remove('hidden');
            return;
        }
    }
    const usersSnap = await get(ref(db, 'users'));
    let exists = false;
    usersSnap.forEach(child => { if(child.val().nickname === nick && child.key !== currentUser.uid) exists = true; });
    if(exists) return showCustomAlert("Erro", "Codinome em uso.");
    if(!isGuest) {
        await update(ref(db, 'users/' + currentUser.uid), { nickname: nick, lastNickChange: serverTimestamp() });
        currentUser.lastNickChange = Date.now();
    }
    currentUser.nickname = nick;
    if(isSetup) {
        startLobby();
    } else {
        showSuccessModal("Codinome atualizado!");
        document.getElementById('display-name').innerText = nick;
        document.getElementById('nick-error-msg').classList.add('hidden');
    }
}

function startLobby() {
    playSound('login');
    document.getElementById('display-name').innerText = currentUser.nickname;
    showScreen('lobby');
}

document.getElementById('btn-my-profile').addEventListener('click', () => {
    if(isGuest) return showCustomAlert("Restrito", "Acesso temporário não possui perfil.");
    document.getElementById('profile-modal').classList.remove('hidden');
    document.getElementById('edit-nickname-input').value = currentUser.nickname;
    loadMyRooms();
});
document.getElementById('btn-close-profile').addEventListener('click', () => {
    document.getElementById('profile-modal').classList.add('hidden');
});
document.getElementById('btn-update-nick').addEventListener('click', () => {
    const newNick = document.getElementById('edit-nickname-input').value;
    saveNickname(newNick, false);
});

document.getElementById('btn-link-password').addEventListener('click', () => {
    const newPass = document.getElementById('link-password-input').value;
    if(newPass.length < 6) return showCustomAlert("Erro", "Senha deve ter 6+ dígitos.");
    const credential = EmailAuthProvider.credential(currentUser.email, newPass);
    linkWithCredential(currentUser, credential)
        .then(() => {
            showSuccessModal("Senha definida! Agora você pode logar com e-mail e senha.");
            document.getElementById('link-password-input').value = '';
        })
        .catch((error) => {
            if(error.code === 'auth/credential-already-exists') {
                showCustomAlert("Erro", "Esta conta já possui senha definida.");
            } else {
                showCustomAlert("Erro", error.message);
            }
        });
});

async function loadMyRooms() {
    const list = document.getElementById('my-rooms-list');
    list.innerHTML = '<p>Carregando...</p>';
    const roomsSnap = await get(ref(db, 'rooms'));
    list.innerHTML = '';
    let count = 0;
    roomsSnap.forEach(child => {
        const room = child.val();
        if(room.config && room.config.ownerId === currentUser.uid) {
            count++;
            const div = document.createElement('div');
            div.className = 'room-item';
            div.innerHTML = `<span>${child.key}</span><div class="room-actions-btn"><button class="btn-mini btn-enter" data-code="${child.key}">Entrar</button><button class="btn-mini btn-pass" data-code="${child.key}">Senha</button></div>`;
            list.appendChild(div);
        }
    });
    if(count === 0) list.innerHTML = '<p>Nenhuma sala criada.</p>';
    document.querySelectorAll('.btn-enter').forEach(b => {
        b.onclick = () => {
            document.getElementById('profile-modal').classList.add('hidden');
            document.getElementById('join-room-code').value = b.dataset.code;
            document.getElementById('join-room-pass').focus(); 
        };
    });
    document.querySelectorAll('.btn-pass').forEach(b => {
        b.onclick = () => {
            targetRoomForPass = b.dataset.code;
            document.getElementById('target-room-name').innerText = targetRoomForPass;
            document.getElementById('change-pass-modal').classList.remove('hidden');
        };
    });
}

document.getElementById('btn-cancel-pass').addEventListener('click', () => {
    document.getElementById('change-pass-modal').classList.add('hidden');
});
document.getElementById('btn-confirm-pass').addEventListener('click', async () => {
    if(!targetRoomForPass) return;
    const newPass = document.getElementById('new-room-pass').value;
    const newHash = CryptoJS.SHA256(newPass).toString();
    await update(ref(db, 'rooms/' + targetRoomForPass + '/config'), { passHash: newHash });
    document.getElementById('change-pass-modal').classList.add('hidden');
    document.getElementById('new-room-pass').value = '';
    showSuccessModal("Senha alterada!");
});

document.getElementById('btn-create-room').addEventListener('click', async () => {
    if(isGuest) return showCustomAlert("Restrito", "Convidados usam salas temporárias no Login.");
    const code = document.getElementById('create-room-code').value.toUpperCase();
    const pass = document.getElementById('create-room-pass').value;
    const isEphemeral = document.getElementById('check-ephemeral-create').checked;
    if (!code) return showCustomAlert("Atenção", "Digite um nome.");
    const roomsSnap = await get(ref(db, 'rooms'));
    let myRoomsCount = 0;
    roomsSnap.forEach(child => {
        const r = child.val();
        if(r.config && r.config.ownerId === currentUser.uid) myRoomsCount++;
    });
    if(myRoomsCount >= 5) return showCustomAlert("Limite", "Máximo 5 salas.");
    const roomSnap = await get(ref(db, 'rooms/' + code));
    if (roomSnap.exists()) return showCustomAlert("Erro", "Sala existente.");
    const passHash = CryptoJS.SHA256(pass).toString();
    set(ref(db, 'rooms/' + code), {
        createdAt: serverTimestamp(),
        config: { isEphemeral: isEphemeral, passHash: passHash, ownerId: currentUser.uid }
    });
    enterRoom(code, pass);
});

document.getElementById('btn-join-room').addEventListener('click', async () => {
    const code = document.getElementById('join-room-code').value.toUpperCase();
    const pass = document.getElementById('join-room-pass').value;
    if (!code) return showCustomAlert("Atenção", "Digite o código.");
    const roomRef = ref(db, 'rooms/' + code);
    const roomSnap = await get(roomRef);
    if (!roomSnap.exists()) return showCustomAlert("Erro", "Não encontrada.");
    const roomData = roomSnap.val();
    if (roomData.config && roomData.config.passHash) {
        if (CryptoJS.SHA256(pass).toString() !== roomData.config.passHash) return showCustomAlert("Erro", "Senha incorreta.");
    }
    enterRoom(code, pass);
});

function enterRoom(roomId, password) {
    currentRoom = roomId;
    roomKey = password.trim() === "" ? "HARDCALL_PUBLIC" : password;
    sessionStorage.setItem('hardcall_room', roomId);
    sessionStorage.setItem('hardcall_key', password);

    connectionTime = Date.now(); 

    document.getElementById('room-id-display').innerText = "Freq: " + roomId;
    document.getElementById('messages-area').innerHTML = '';
    document.getElementById('room-settings-modal').classList.add('hidden');
    document.getElementById('users-overlay').classList.add('hidden');
    
    const tempWarning = document.getElementById('temp-room-warning');
    const settingsBtn = document.getElementById('btn-room-settings');
    if (isGuest) {
        tempWarning.classList.remove('hidden');
        settingsBtn.classList.add('hidden'); 
    } else {
        tempWarning.classList.add('hidden');
        settingsBtn.classList.remove('hidden');
    }

    showScreen('chat');
    setupPresence(roomId);
    loadMessages(roomId);
    syncRoomSettings(roomId);
    playSound('login');
    
    window.visualViewport.addEventListener('resize', () => {
        const area = document.getElementById('messages-area');
        area.scrollTop = area.scrollHeight;
    });
}

window.addEventListener('pagehide', () => {
    if (currentRoom && userStatusRef) remove(userStatusRef);
});

document.getElementById('btn-leave-room').addEventListener('click', leaveRoom);
function leaveRoom() {
    if (!currentRoom) return;
    sessionStorage.removeItem('hardcall_room');
    sessionStorage.removeItem('hardcall_key');

    checkAndDestroy(currentRoom);
    if (userStatusRef) remove(userStatusRef);
    currentRoom = null;
    roomKey = null;
    if(isGuest) {
        signOut(auth);
        location.reload();
    } else {
        showScreen('lobby');
    }
}

function syncRoomSettings(roomId) {
    const configRef = ref(db, 'rooms/' + roomId + '/config');
    onValue(configRef, (snap) => {
        const config = snap.val() || {};
        const checkbox = document.getElementById('check-ephemeral-room');
        checkbox.checked = config.isEphemeral === true;
        if(!isGuest && config.ownerId === currentUser.uid) {
            checkbox.disabled = false;
            checkbox.onclick = () => { update(configRef, { isEphemeral: checkbox.checked }); };
            document.getElementById('btn-nuke-room').style.display = 'block';
        } else {
            checkbox.disabled = true;
            document.getElementById('btn-nuke-room').style.display = 'none';
        }
    });
}

document.getElementById('btn-room-users').addEventListener('click', () => {
    document.getElementById('users-overlay').classList.toggle('hidden');
    document.getElementById('room-settings-modal').classList.add('hidden');
});
document.getElementById('btn-room-settings').addEventListener('click', () => {
    document.getElementById('room-settings-modal').classList.toggle('hidden');
    document.getElementById('users-overlay').classList.add('hidden');
});
document.getElementById('btn-close-settings').addEventListener('click', () => {
    document.getElementById('room-settings-modal').classList.add('hidden');
});
document.getElementById('btn-nuke-room').addEventListener('click', () => {
    showCustomConfirm("ZONA DE PERIGO", "☢️ DESTRUIR SALA?", (confirmed) => {
        if(confirmed) {
            playSound('explosion'); // <--- O som toca aqui!
            
            // Pequeno delay para o usuário ouvir o som antes da tela mudar
            setTimeout(() => {
                remove(ref(db, 'rooms/' + currentRoom));
                leaveRoom();
            }, 500); 
        }
    });
});

function setupPresence(roomId) {
    userStatusRef = ref(db, 'rooms/' + roomId + '/users/' + currentUser.uid);
    onDisconnect(userStatusRef).remove();
    set(userStatusRef, { nickname: currentUser.nickname, status: 'online', lastSeen: serverTimestamp() });
    onValue(ref(db, 'rooms/' + roomId + '/users'), (snap) => {
        document.getElementById('online-count').innerText = snap.size;
        const list = document.getElementById('users-list');
        list.innerHTML = '';
        snap.forEach(c => {
            const li = document.createElement('li');
            li.innerText = c.val().nickname;
            if(c.key === currentUser.uid) {
                li.classList.add('me');
                li.innerText += " (Você)";
            }
            list.appendChild(li);
        });
    });
}

async function checkAndDestroy(roomId) {
    const roomRef = ref(db, 'rooms/' + roomId);
    const roomSnap = await get(roomRef);
    if (roomSnap.exists()) {
        const data = roomSnap.val();
        const users = data.users || {};
        if (Object.keys(users).length <= 1 && data.config && data.config.isEphemeral) {
            remove(roomRef);
        }
    }
}

document.getElementById('btn-send').addEventListener('click', sendMessage);
document.getElementById('message-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value;
    if (!text.trim()) return;
    const encryptedText = CryptoJS.AES.encrypt(text, roomKey).toString();
    const msgData = { sender: currentUser.nickname, text: encryptedText, timestamp: serverTimestamp() };
    if (replyingTo) {
        msgData.replyTo = replyingTo.sender + ": " + replyingTo.text;
        replyingTo = null;
        document.getElementById('reply-preview').classList.add('hidden');
    }
    push(ref(db, 'rooms/' + currentRoom + '/messages'), msgData);
    input.value = '';
    playSound('click'); 
}

function loadMessages(roomId) {
    const messagesRef = ref(db, 'rooms/' + roomId + '/messages');
    onChildAdded(messagesRef, (snapshot) => {
        const data = snapshot.val();
        if(data) renderMessage(data);
    });
}

function renderMessage(data) {
    const area = document.getElementById('messages-area');
    let decryptedText = "";
    try {
        decryptedText = CryptoJS.AES.decrypt(data.text, roomKey).toString(CryptoJS.enc.Utf8);
    } catch (e) { decryptedText = "🔒 [Falha na Descriptografia]"; }
    if (!decryptedText) return;
    const div = document.createElement('div');
    const isMe = data.sender === currentUser.nickname;
    
    if (!isMe && data.timestamp > connectionTime) {
        playSound('message'); 
    }

    div.classList.add('msg', isMe ? 'sent' : 'received');
    div.addEventListener('dblclick', () => startReply(data.sender, decryptedText));
    const date = new Date(data.timestamp || Date.now());
    const timeStr = date.getHours().toString().padStart(2,'0') + ':' + date.getMinutes().toString().padStart(2,'0');
    let quoteHTML = data.replyTo ? `<span class="reply-quote">Resp: ${data.replyTo}</span>` : '';
    div.innerHTML = `<span class="sender">${data.sender}</span>${quoteHTML}${decryptedText}<span class="time">${timeStr}</span>`;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
}

function startReply(sender, text) {
    replyingTo = { sender, text: text.substring(0, 30) + "..." };
    document.getElementById('reply-preview').classList.remove('hidden');
    document.getElementById('reply-text').innerText = `Respondendo a ${sender}: "${replyingTo.text}"`;
    document.getElementById('message-input').focus();
}
document.getElementById('btn-cancel-reply').addEventListener('click', () => {
    replyingTo = null;
    document.getElementById('reply-preview').classList.add('hidden');
});

// Função para cancelar o login de convidado e fechar o modal
function closeGuestModal() {
    document.getElementById('guest-nick-modal').classList.add('hidden');
    // Como ele já iniciou o login anônimo no Firebase, fazemos logout para limpar
    signOut(auth); 
    isGuest = false;
}

document.getElementById('btn-close-guest-nick').addEventListener('click', closeGuestModal);

document.getElementById('guest-nick-modal').addEventListener('click', (e) => {
    if (e.target.id === 'guest-nick-modal') {
        closeGuestModal();
        playSound('click');
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (!document.getElementById('guest-nick-modal').classList.contains('hidden')) {
            closeGuestModal();
        } else if (currentRoom) {
            leaveRoom();
        }
    }
});
