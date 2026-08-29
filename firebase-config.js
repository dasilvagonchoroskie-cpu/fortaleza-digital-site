// Configuração de conexão com o Firebase do projeto Fortaleza Digital
const firebaseConfig = {
  apiKey: "AIzaSyDf30MvuHaHQ-_dmX3SHqYuNA7s7ZKXbH0",
  authDomain: "fortaleza-digital-17635.firebaseapp.com",
  projectId: "fortaleza-digital-17635",
  storageBucket: "fortaleza-digital-17635.firebasestorage.app",
  messagingSenderId: "888199931982",
  appId: "1:888199931982:web:ad107414cfc89b07ee3b1f"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
