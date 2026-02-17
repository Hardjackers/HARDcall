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

// --- SALAS E CHAT ---
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
    
    // FIX MOBILE: Rolar para o fim ao abrir teclado
    window.visualViewport.addEventListener('resize', () => {
        const area = document.getElementById('messages-area');
        area.scrollTop = area.scrollHeight;
    });
}

// CORREÇÃO SAFARI: Mata sessão ao fechar aba
window.addEventListener('pagehide', () => {
    if (currentRoom && userStatusRef) remove(userStatusRef);
});

document.getElementById('btn-leave-room').addEventListener('click', leaveRoom);
function leaveRoom() {
    if (!currentRoom) return;
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
            remove(ref(db, 'rooms/' + currentRoom));
            leaveRoom();
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
        // Se só tem eu (1) ou ninguém (0), pode apagar
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
