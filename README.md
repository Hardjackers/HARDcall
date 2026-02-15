# HARDcall 🔒
> **Secure Communication Portal**

![Version](https://img.shields.io/badge/version-1.0-cyan?style=for-the-badge)
![Status](https://img.shields.io/badge/status-stable-success?style=for-the-badge)
![License](https://img.shields.io/badge/license-Hardjackers-red?style=for-the-badge)

## 📡 Sobre o Projeto

O **HARDcall** é uma plataforma de comunicação focada em privacidade e segurança. Desenvolvido para oferecer canais de bate-papo rápidos, seguros e, opcionalmente, voláteis.

Diferente de apps convencionais, o HARDcall permite a criação de **Salas Temporárias** que operam sob a lógica de *autodestruição*: assim que o último participante sai, todos os rastros da conversa são apagados permanentemente do servidor.

## 🚀 Funcionalidades Principais

* **🔒 Criptografia Militar (AES):** Todas as mensagens são criptografadas no navegador antes de serem enviadas. O servidor armazena apenas o hash, garantindo privacidade total.
* **💣 Autodestruição de Salas:** Salas configuradas como "Temporárias" deixam de existir assim que a sessão termina.
* **🕵️ Acesso Híbrido:**
    * **Login Permanente:** Via Google ou E-mail/Senha (salva configurações e histórico de salas criadas).
    * **Modo Fantasma (Guest):** Acesso totalmente anônimo para chats rápidos sem deixar rastros.
* **🛡️ Gestão de Identidade:** Sistema de proteção de nickname (troca permitida apenas a cada 7 dias para usuários registrados).
* **🎨 UI Cyberpunk:** Interface imersiva, responsiva e focada em usabilidade com tema Dark/Neon.

## 🛠️ Tecnologias Utilizadas

* **Frontend:** HTML5, CSS3 (Design Responsivo), JavaScript (ES6+ Modules).
* **Backend / Infra:** Google Firebase (Authentication & Realtime Database).
* **Segurança:** CryptoJS (para criptografia AES-256 e Hashing SHA-256).

## 📸 Screenshots

| Tela de Login | Chat Seguro |
|:---:|:---:|
| <img src="URL_DA_SUA_IMAGEM_LOGIN_AQUI" width="400"> | <img src="URL_DA_SUA_IMAGEM_CHAT_AQUI" width="400"> |

> *Interface com feedback visual em tempo real e sistema de alertas.*

## ⚙️ Instalação e Uso

Este projeto é uma aplicação web estática ("Client-Side") que se conecta ao Firebase.

1.  **Clone o repositório:**
    ```bash
    git clone [https://github.com/Hardjackers/HARDcall.git](https://github.com/Hardjackers/HARDcall.git)
    ```
2.  **Configuração:**
    * Crie um projeto no [Firebase Console](https://console.firebase.google.com/).
    * Habilite **Authentication** (Google, Email/Senha e Anônimo).
    * Habilite **Realtime Database**.
    * Copie suas chaves de API.
3.  **Integração:**
    * Abra o arquivo `app.js`.
    * Substitua o objeto `firebaseConfig` pelas suas credenciais.
4.  **Rodar:**
    * Basta abrir o `index.html` em seu navegador ou usar uma extensão como "Live Server".

## ⚠️ Aviso Legal

Este software é fornecido "como está", sem garantias. O **HARDcall** não armazena logs de mensagens descriptografadas. A responsabilidade pelo uso da ferramenta e pela guarda das senhas de acesso às salas é inteiramente do usuário final.

---

### 👨‍💻 Desenvolvedor

<div align="center">
  
**Desenvolvido por Hardjackers** *Criando soluções digitais com segurança e estilo.*

[![GitHub](https://img.shields.io/badge/GitHub-Hardjackers-white?style=flat&logo=github)](https://github.com/Hardjackers)

</div>