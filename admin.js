// ----- LOGIN -----
auth.onAuthStateChanged(function(user) {
  if (user) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('painel').style.display = 'block';
    carregarTextos();
    carregarServicos();
    carregarPortfolio();
    carregarContato();
  } else {
    document.getElementById('login-screen').style.display = 'block';
    document.getElementById('painel').style.display = 'none';
  }
});

function fazerLogin() {
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  const erroEl = document.getElementById('login-erro');
  erroEl.textContent = '';

  auth.signInWithEmailAndPassword(email, senha).catch(function(error) {
    erroEl.textContent = 'E-mail ou senha incorretos.';
    console.error(error);
  });
}

function sair() {
  auth.signOut();
}

function trocarSenha() {
  const novaSenha = prompt('Digite sua nova senha (mínimo 6 caracteres):');
  if (!novaSenha) return;
  auth.currentUser.updatePassword(novaSenha).then(function() {
    document.getElementById('senha-msg').textContent = 'Senha alterada com sucesso!';
  }).catch(function(error) {
    alert('Erro ao trocar senha: ' + error.message + '\n\nPode ser necessário sair e entrar de novo antes de trocar a senha.');
  });
}

// ----- TEXTOS GERAIS DO SITE -----
let textosDocId = null;

function carregarTextos() {
  db.collection('conteudo').limit(1).get().then(function(snapshot) {
    if (snapshot.empty) return;
    textosDocId = snapshot.docs[0].id;
    const data = snapshot.docs[0].data();
    document.getElementById('texto-eyebrow').value = data.eyebrow || '';
    document.getElementById('texto-titulo').value = data.titulo || '';
    document.getElementById('texto-descricao').value = data.descricao || '';
    document.getElementById('texto-botao').value = data.botao || '';
  });
}

function salvarTextos() {
  const eyebrow = document.getElementById('texto-eyebrow').value.trim();
  const titulo = document.getElementById('texto-titulo').value.trim();
  const descricao = document.getElementById('texto-descricao').value.trim();
  const botao = document.getElementById('texto-botao').value.trim();

  const dados = { eyebrow, titulo, descricao, botao };

  if (!textosDocId) {
    db.collection('conteudo').add(dados).then(function(docRef) {
      textosDocId = docRef.id;
      document.getElementById('textos-msg').textContent = 'Textos salvos!';
      setTimeout(() => { document.getElementById('textos-msg').textContent = ''; }, 3000);
    });
    return;
  }

  db.collection('conteudo').doc(textosDocId).update(dados).then(function() {
    document.getElementById('textos-msg').textContent = 'Textos salvos!';
    setTimeout(() => { document.getElementById('textos-msg').textContent = ''; }, 3000);
  }).catch(function(error) {
    alert('Erro ao salvar: ' + error.message);
  });
}

// ----- SERVIÇOS -----
function carregarServicos() {
  db.collection('serviços').orderBy('ordem').get().then(function(snapshot) {
    const container = document.getElementById('lista-servicos');
    container.innerHTML = '';
    snapshot.forEach(function(doc) {
      const data = doc.data();
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <div class="item-info">
          <strong>${escapeHtml(data.titulo || '')} (ordem ${data.ordem})</strong>
          <span>${escapeHtml(data.descricao || '')}</span>
        </div>
        <div class="item-actions">
          <button class="admin-btn secondary" onclick="editarServico('${doc.id}')">Editar</button>
          <button class="admin-btn danger" onclick="apagarServico('${doc.id}')">Apagar</button>
        </div>
      `;
      container.appendChild(row);
    });
  });
}

function adicionarServico() {
  const titulo = document.getElementById('novo-servico-titulo').value.trim();
  const descricao = document.getElementById('novo-servico-descricao').value.trim();
  const ordem = parseInt(document.getElementById('novo-servico-ordem').value) || 0;

  if (!titulo) { alert('Preencha o título.'); return; }

  db.collection('serviços').add({ titulo, descricao, ordem }).then(function() {
    document.getElementById('novo-servico-titulo').value = '';
    document.getElementById('novo-servico-descricao').value = '';
    document.getElementById('novo-servico-ordem').value = '';
    carregarServicos();
  }).catch(function(error) {
    alert('Erro ao adicionar: ' + error.message);
  });
}

function editarServico(id) {
  db.collection('serviços').doc(id).get().then(function(doc) {
    const data = doc.data();
    const novoTitulo = prompt('Título:', data.titulo);
    if (novoTitulo === null) return;
    const novaDescricao = prompt('Descrição:', data.descricao);
    if (novaDescricao === null) return;
    const novaOrdem = prompt('Ordem:', data.ordem);
    if (novaOrdem === null) return;

    db.collection('serviços').doc(id).update({
      titulo: novoTitulo,
      descricao: novaDescricao,
      ordem: parseInt(novaOrdem) || 0
    }).then(carregarServicos);
  });
}

function apagarServico(id) {
  if (!confirm('Tem certeza que quer apagar este serviço?')) return;
  db.collection('serviços').doc(id).delete().then(carregarServicos);
}

// ----- PORTFÓLIO -----
function carregarPortfolio() {
  db.collection('portfolio').get().then(function(snapshot) {
    const container = document.getElementById('lista-portfolio');
    container.innerHTML = '';
    snapshot.forEach(function(doc) {
      const data = doc.data();
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <div class="item-info">
          <strong>${escapeHtml(data.titulo || '')}</strong>
          <span>${escapeHtml(data.descricao || '')}</span>
        </div>
        <div class="item-actions">
          <button class="admin-btn secondary" onclick="editarProjeto('${doc.id}')">Editar</button>
          <button class="admin-btn danger" onclick="apagarProjeto('${doc.id}')">Apagar</button>
        </div>
      `;
      container.appendChild(row);
    });
  });
}

function adicionarProjeto() {
  const titulo = document.getElementById('novo-projeto-titulo').value.trim();
  const descricao = document.getElementById('novo-projeto-descricao').value.trim();
  const imagem = document.getElementById('novo-projeto-imagem').value.trim();

  if (!titulo) { alert('Preencha o título.'); return; }

  db.collection('portfolio').add({ titulo, descricao, imagem }).then(function() {
    document.getElementById('novo-projeto-titulo').value = '';
    document.getElementById('novo-projeto-descricao').value = '';
    document.getElementById('novo-projeto-imagem').value = '';
    carregarPortfolio();
  }).catch(function(error) {
    alert('Erro ao adicionar: ' + error.message);
  });
}

function editarProjeto(id) {
  db.collection('portfolio').doc(id).get().then(function(doc) {
    const data = doc.data();
    const novoTitulo = prompt('Título:', data.titulo);
    if (novoTitulo === null) return;
    const novaDescricao = prompt('Descrição:', data.descricao);
    if (novaDescricao === null) return;

    db.collection('portfolio').doc(id).update({
      titulo: novoTitulo,
      descricao: novaDescricao
    }).then(carregarPortfolio);
  });
}

function apagarProjeto(id) {
  if (!confirm('Tem certeza que quer apagar este projeto?')) return;
  db.collection('portfolio').doc(id).delete().then(carregarPortfolio);
}

// ----- CONTATO -----
let contatoDocId = null;

function carregarContato() {
  db.collection('contato').limit(1).get().then(function(snapshot) {
    if (snapshot.empty) return;
    contatoDocId = snapshot.docs[0].id;
    const data = snapshot.docs[0].data();
    document.getElementById('contato-whatsapp').value = data.whatsapp || '';
    document.getElementById('contato-email').value = data.email || '';
  });
}

function salvarContato() {
  const whatsapp = document.getElementById('contato-whatsapp').value.trim();
  const email = document.getElementById('contato-email').value.trim();

  if (!contatoDocId) {
    db.collection('contato').add({ whatsapp, email }).then(function(docRef) {
      contatoDocId = docRef.id;
      document.getElementById('contato-msg').textContent = 'Contato salvo!';
    });
    return;
  }

  db.collection('contato').doc(contatoDocId).update({ whatsapp, email }).then(function() {
    document.getElementById('contato-msg').textContent = 'Contato salvo!';
    setTimeout(() => { document.getElementById('contato-msg').textContent = ''; }, 3000);
  }).catch(function(error) {
    alert('Erro ao salvar: ' + error.message);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
