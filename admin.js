// ===== CONFIGURAÇÃO DO IMGBB (upload automático de fotos) =====
const IMGBB_API_KEY = '61956ffcfe2f0d78692db113027c5319';

// Temas prontos — contraste já conferido (mesma lista de script.js)
const TEMAS = {
  'teal-escuro':      { bg: '#0B1220', texto: '#F1F5F9', destaque: '#2DD4BF' },
  'azul-cibernetico': { bg: '#0A0E1A', texto: '#E8EEF7', destaque: '#4C8DFF' },
  'verde-seguranca':  { bg: '#0A140D', texto: '#E5F2E8', destaque: '#4ADE80' },
  'grafite':          { bg: '#161819', texto: '#F0F0F0', destaque: '#2DD4BF' },
  'claro-corporativo':{ bg: '#F4F6F9', texto: '#12181F', destaque: '#0F6E63' },
  'roxo-tech':        { bg: '#120A1A', texto: '#F0EAF5', destaque: '#9D6FE0' }
};
const TEMA_PADRAO = 'teal-escuro';
const CACHE_CONFIG_CHAVE = 'fortaleza_config_cache';

let temaSelecionado = TEMA_PADRAO;
let fonteSelecionada = '1';

function ajustarCor(hex, quantidade) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(function(c) { return c + c; }).join('');
  const num = parseInt(hex, 16);
  let r = (num >> 16) + quantidade;
  let g = ((num >> 8) & 0x00FF) + quantidade;
  let b = (num & 0x0000FF) + quantidade;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1).toUpperCase();
}

function aplicarTema(nome) {
  const tema = TEMAS[nome] || TEMAS[TEMA_PADRAO];
  const raiz = document.documentElement.style;
  raiz.setProperty('--bg', tema.bg);
  raiz.setProperty('--surface', ajustarCor(tema.bg, 14));
  raiz.setProperty('--surface-2', ajustarCor(tema.bg, 8));
  raiz.setProperty('--border', ajustarCor(tema.bg, 40));
  raiz.setProperty('--danger-bg', ajustarCor(tema.bg, 12));
  raiz.setProperty('--success-bg', ajustarCor(tema.bg, 12));
  raiz.setProperty('--text', tema.texto);
  raiz.setProperty('--text-muted', ajustarCor(tema.texto, -60));
  raiz.setProperty('--accent', tema.destaque);
  raiz.setProperty('--accent-dim', ajustarCor(tema.destaque, -35));
}

function aplicarEscalaFonte(valor) {
  document.documentElement.style.setProperty('--escala-fonte', valor);
}

function escolherTema(nome) {
  temaSelecionado = nome;
  document.querySelectorAll('.tema-swatch').forEach(function(btn) {
    btn.classList.toggle('ativo', btn.dataset.tema === nome);
  });
  aplicarTema(nome);
}

function escolherFonte(valor) {
  fonteSelecionada = valor;
  document.querySelectorAll('.fonte-opcao').forEach(function(btn) {
    btn.classList.toggle('ativo', btn.dataset.fonte === valor);
  });
  aplicarEscalaFonte(valor);
}

// Aplica o tema salvo em cache local imediatamente (antes do Firestore
// responder) — mesma chave usada em script.js, então trocar entre o
// site e o painel já vem com a cor certa.
try {
  const emCache = localStorage.getItem(CACHE_CONFIG_CHAVE);
  if (emCache) {
    const dataCache = JSON.parse(emCache);
    temaSelecionado = dataCache.tema || TEMA_PADRAO;
    fonteSelecionada = dataCache.escalaFonte || '1';
    aplicarTema(temaSelecionado);
    aplicarEscalaFonte(fonteSelecionada);
  }
} catch (e) {}

function uploadImagemImgBB(arquivo) {
  return new Promise(function(resolve, reject) {
    if (!arquivo) { reject('Nenhum arquivo selecionado.'); return; }
    const formData = new FormData();
    formData.append('image', arquivo);
    fetch('https://api.imgbb.com/1/upload?key=' + IMGBB_API_KEY, {
      method: 'POST',
      body: formData
    })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data && data.success) {
          resolve({ url: data.data.url, deleteUrl: data.data.delete_url || '' });
        } else {
          reject((data && data.error && data.error.message) || 'Erro ao enviar imagem.');
        }
      })
      .catch(function(err) { reject(err.message || 'Erro de conexão ao enviar imagem.'); });
  });
}

// Envia várias fotos em sequência e devolve um array [{url, deleteUrl}, ...]
function uploadVariasImagensImgBB(arquivos) {
  const lista = Array.prototype.slice.call(arquivos);
  let resultados = [];
  return lista.reduce(function(promessaAnterior, arquivo) {
    return promessaAnterior.then(function() {
      return uploadImagemImgBB(arquivo).then(function(r) { resultados.push(r); });
    });
  }, Promise.resolve()).then(function() { return resultados; });
}

function tentarApagarDoImgBB(deleteUrl) {
  if (!deleteUrl) return;
  fetch(deleteUrl, { mode: 'no-cors' }).catch(function() {});
}

// ----- LOGIN -----
auth.onAuthStateChanged(function(user) {
  if (user) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('painel').style.display = 'block';
    document.getElementById('admin-tabs').style.display = 'flex';
    mostrarAba('conteudo');
    carregarTextos();
    carregarServicos();
    carregarPortfolio();
    carregarContato();
    carregarEquipe();
  } else {
    document.getElementById('login-screen').style.display = 'block';
    document.getElementById('painel').style.display = 'none';
    document.getElementById('admin-tabs').style.display = 'none';
  }
});

function mostrarAba(nome) {
  ['conteudo', 'portfolio', 'contato', 'conta'].forEach(function(aba) {
    document.getElementById('painel-' + aba).style.display = (aba === nome) ? 'block' : 'none';
  });
  document.querySelectorAll('.admin-tab').forEach(function(btn) {
    btn.classList.toggle('ativo', btn.dataset.aba === nome);
  });
  window.scrollTo(0, 0);
}

function fazerLogin() {
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  const erroEl = document.getElementById('login-erro');
  erroEl.textContent = '';

  auth.signInWithEmailAndPassword(email, senha).catch(function(error) {
    erroEl.textContent = 'Erro (' + error.code + '): ' + error.message;
    console.error(error);
  });
}

function recuperarSenha() {
  const erroEl = document.getElementById('login-erro');
  let email = document.getElementById('login-email').value.trim();
  if (!email) {
    email = prompt('Digite o e-mail cadastrado do painel:');
    if (!email) return;
  }
  erroEl.textContent = '';
  auth.sendPasswordResetEmail(email).then(function() {
    erroEl.style.color = 'var(--success)';
    erroEl.textContent = 'Enviamos um link pra ' + email + '. Abra o e-mail e siga o link pra criar uma senha nova.';
  }).catch(function(error) {
    erroEl.style.color = '';
    erroEl.textContent = 'Erro (' + error.code + '): ' + error.message;
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

// ----- TEXTOS GERAIS DO SITE (e aparência, guardada no mesmo documento) -----
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

    temaSelecionado = data.tema || TEMA_PADRAO;
    fonteSelecionada = data.escalaFonte || '1';
    document.querySelectorAll('.tema-swatch').forEach(function(btn) {
      btn.classList.toggle('ativo', btn.dataset.tema === temaSelecionado);
    });
    document.querySelectorAll('.fonte-opcao').forEach(function(btn) {
      btn.classList.toggle('ativo', btn.dataset.fonte === fonteSelecionada);
    });
    aplicarTema(temaSelecionado);
    aplicarEscalaFonte(fonteSelecionada);
    mostrarPreviewBanner(data.bannerUrl || '');

    try { localStorage.setItem(CACHE_CONFIG_CHAVE, JSON.stringify(data)); } catch (e) {}
  });
}

function mostrarPreviewBanner(url) {
  const wrap = document.getElementById('banner-preview-wrap');
  wrap.innerHTML = url
    ? '<img src="' + url + '" style="max-width:100%;display:block;margin-bottom:10px;border-radius:8px;border:1px solid var(--border);">'
    : '<p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:10px;">Nenhum banner definido ainda.</p>';
}

function salvarBanner() {
  const statusEl = document.getElementById('banner-status');
  const msgEl = document.getElementById('banner-msg');
  const arquivoInput = document.getElementById('banner-foto');
  const arquivo = arquivoInput.files[0];

  if (!arquivo) { msgEl.textContent = 'Escolha uma foto primeiro.'; return; }
  if (!textosDocId) { msgEl.textContent = 'Salve os textos principais uma vez antes do banner.'; return; }

  statusEl.textContent = 'Enviando banner...';
  uploadImagemImgBB(arquivo).then(function(resultado) {
    return db.collection('conteudo').doc(textosDocId).set({
      bannerUrl: resultado.url,
      bannerDeleteUrl: resultado.deleteUrl
    }, { merge: true });
  }).then(function() {
    statusEl.textContent = '';
    arquivoInput.value = '';
    msgEl.textContent = 'Banner salvo!';
    setTimeout(() => { msgEl.textContent = ''; }, 3000);
    carregarTextos();
  }).catch(function(erro) {
    statusEl.textContent = '';
    alert('Erro ao enviar o banner: ' + erro);
  });
}

function removerBanner() {
  if (!textosDocId) return;
  if (!confirm('Remover o banner do site?')) return;
  db.collection('conteudo').doc(textosDocId).get().then(function(doc) {
    const data = doc.data();
    if (data.bannerDeleteUrl) tentarApagarDoImgBB(data.bannerDeleteUrl);
    return db.collection('conteudo').doc(textosDocId).set({ bannerUrl: '', bannerDeleteUrl: '' }, { merge: true });
  }).then(function() {
    document.getElementById('banner-msg').textContent = 'Banner removido.';
    carregarTextos();
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

  db.collection('conteudo').doc(textosDocId).set(dados, { merge: true }).then(function() {
    document.getElementById('textos-msg').textContent = 'Textos salvos!';
    setTimeout(() => { document.getElementById('textos-msg').textContent = ''; }, 3000);
  }).catch(function(error) {
    alert('Erro ao salvar: ' + error.message);
  });
}

function salvarAparencia() {
  const msgEl = document.getElementById('aparencia-msg');
  const dados = { tema: temaSelecionado, escalaFonte: fonteSelecionada };

  if (!textosDocId) {
    db.collection('conteudo').add(dados).then(function(docRef) {
      textosDocId = docRef.id;
      msgEl.textContent = 'Aparência salva!';
      setTimeout(() => { msgEl.textContent = ''; }, 3000);
    });
    return;
  }

  db.collection('conteudo').doc(textosDocId).set(dados, { merge: true }).then(function() {
    msgEl.textContent = 'Aparência salva!';
    setTimeout(() => { msgEl.textContent = ''; }, 3000);
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

// ----- PORTFÓLIO (agora com várias fotos por projeto) -----
function carregarPortfolio() {
  db.collection('portfolio').get().then(function(snapshot) {
    const container = document.getElementById('lista-portfolio');
    container.innerHTML = '';
    snapshot.forEach(function(doc) {
      const data = doc.data();
      const qtdFotos = Array.isArray(data.fotos) ? data.fotos.length : (data.imagem ? 1 : 0);
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <div class="item-info">
          <strong>${escapeHtml(data.titulo || '')}</strong>
          <span>${escapeHtml(data.descricao || '')} — ${qtdFotos} foto(s)</span>
        </div>
        <div class="item-actions">
          <button class="admin-btn secondary" onclick="editarProjeto('${doc.id}')">Editar texto</button>
          <button class="admin-btn secondary" onclick="abrirGerenciarFotos('${doc.id}')">Gerenciar fotos</button>
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
  const arquivoInput = document.getElementById('novo-projeto-fotos');
  const statusEl = document.getElementById('novo-projeto-fotos-status');

  if (!titulo) { alert('Preencha o título.'); return; }

  function salvarNoFirestore(fotos) {
    db.collection('portfolio').add({ titulo, descricao, fotos: fotos || [] }).then(function() {
      document.getElementById('novo-projeto-titulo').value = '';
      document.getElementById('novo-projeto-descricao').value = '';
      arquivoInput.value = '';
      statusEl.textContent = '';
      carregarPortfolio();
    }).catch(function(error) {
      alert('Erro ao adicionar: ' + error.message);
    });
  }

  const arquivos = arquivoInput.files;
  if (arquivos && arquivos.length) {
    statusEl.textContent = 'Enviando ' + arquivos.length + ' foto(s)...';
    uploadVariasImagensImgBB(arquivos).then(function(resultados) {
      statusEl.textContent = 'Fotos enviadas!';
      salvarNoFirestore(resultados);
    }).catch(function(erro) {
      statusEl.textContent = '';
      alert('Erro ao enviar as fotos: ' + erro);
    });
  } else {
    salvarNoFirestore([]);
  }
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
  if (!confirm('Tem certeza que quer apagar este projeto? Todas as fotos dele somem também.')) return;
  db.collection('portfolio').doc(id).get().then(function(doc) {
    const data = doc.data();
    const fotos = Array.isArray(data.fotos) ? data.fotos : (data.imagem ? [{ url: data.imagem, deleteUrl: data.imagemDeleteUrl }] : []);
    fotos.forEach(function(f) { if (f.deleteUrl) tentarApagarDoImgBB(f.deleteUrl); });
    return db.collection('portfolio').doc(id).delete();
  }).then(carregarPortfolio);
}

// ----- Gerenciador de fotos de um projeto (modal) -----
let projetoFotosId = null;

function abrirGerenciarFotos(id) {
  projetoFotosId = id;
  db.collection('portfolio').doc(id).get().then(function(doc) {
    renderizarGradeFotos(doc.data());
    document.getElementById('fotos-modal-input').value = '';
    document.getElementById('fotos-modal-status').textContent = '';
    document.getElementById('fotos-modal').style.display = 'flex';
  });
}

function renderizarGradeFotos(data) {
  const fotos = Array.isArray(data.fotos) ? data.fotos : (data.imagem ? [{ url: data.imagem, deleteUrl: data.imagemDeleteUrl }] : []);
  const grid = document.getElementById('fotos-modal-grid');
  if (!fotos.length) {
    grid.innerHTML = '<p style="font-size:0.8125rem;color:var(--text-muted);grid-column:1/-1;">Nenhuma foto ainda.</p>';
    return;
  }
  grid.innerHTML = fotos.map(function(f, i) {
    return `<div class="fotos-modal-item">
      <img src="${escapeHtml(f.url)}" alt="">
      <button type="button" onclick="removerFotoDoProjeto(${i})" aria-label="Remover">×</button>
    </div>`;
  }).join('');
}

function removerFotoDoProjeto(indice) {
  if (!projetoFotosId) return;
  if (!confirm('Remover esta foto do projeto?')) return;
  db.collection('portfolio').doc(projetoFotosId).get().then(function(doc) {
    const data = doc.data();
    const fotos = Array.isArray(data.fotos) ? data.fotos.slice() : (data.imagem ? [{ url: data.imagem, deleteUrl: data.imagemDeleteUrl }] : []);
    const removida = fotos.splice(indice, 1)[0];
    if (removida && removida.deleteUrl) tentarApagarDoImgBB(removida.deleteUrl);
    return db.collection('portfolio').doc(projetoFotosId).set({ fotos: fotos, imagem: firebase.firestore.FieldValue.delete(), imagemDeleteUrl: firebase.firestore.FieldValue.delete() }, { merge: true });
  }).then(function() {
    return db.collection('portfolio').doc(projetoFotosId).get();
  }).then(function(doc) {
    renderizarGradeFotos(doc.data());
    carregarPortfolio();
  });
}

function adicionarFotosAoProjeto() {
  if (!projetoFotosId) return;
  const input = document.getElementById('fotos-modal-input');
  const statusEl = document.getElementById('fotos-modal-status');
  const arquivos = input.files;
  if (!arquivos || !arquivos.length) { alert('Escolha ao menos uma foto primeiro.'); return; }

  statusEl.textContent = 'Enviando ' + arquivos.length + ' foto(s)...';
  uploadVariasImagensImgBB(arquivos).then(function(novasFotos) {
    return db.collection('portfolio').doc(projetoFotosId).get().then(function(doc) {
      const data = doc.data();
      const fotosAtuais = Array.isArray(data.fotos) ? data.fotos : (data.imagem ? [{ url: data.imagem, deleteUrl: data.imagemDeleteUrl }] : []);
      const fotosFinais = fotosAtuais.concat(novasFotos);
      return db.collection('portfolio').doc(projetoFotosId).set({ fotos: fotosFinais, imagem: firebase.firestore.FieldValue.delete(), imagemDeleteUrl: firebase.firestore.FieldValue.delete() }, { merge: true });
    });
  }).then(function() {
    statusEl.textContent = 'Fotos adicionadas!';
    input.value = '';
    return db.collection('portfolio').doc(projetoFotosId).get();
  }).then(function(doc) {
    renderizarGradeFotos(doc.data());
    carregarPortfolio();
  }).catch(function(erro) {
    statusEl.textContent = '';
    alert('Erro ao enviar as fotos: ' + erro);
  });
}

function fecharGerenciarFotos() {
  document.getElementById('fotos-modal').style.display = 'none';
  projetoFotosId = null;
}

// ----- CONTATO GERAL (WhatsApp flutuante + e-mail principal) -----
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

// ----- EQUIPE (contatos adicionais, com foto) -----
function carregarEquipe() {
  db.collection('equipe').get().then(function(snapshot) {
    const container = document.getElementById('lista-equipe');
    container.innerHTML = '';
    snapshot.forEach(function(doc) {
      const data = doc.data();
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <div class="item-info">
          <strong>${escapeHtml(data.nome || '')} — ${escapeHtml(data.cargo || '')}</strong>
          <span>${escapeHtml(data.whatsapp || '')}${data.email ? ' · ' + escapeHtml(data.email) : ''}</span>
        </div>
        <div class="item-actions">
          <button class="admin-btn secondary" onclick="editarMembro('${doc.id}')">Editar</button>
          <button class="admin-btn danger" onclick="apagarMembro('${doc.id}')">Apagar</button>
        </div>
      `;
      container.appendChild(row);
    });
  });
}

function adicionarMembro() {
  const nome = document.getElementById('novo-membro-nome').value.trim();
  const cargo = document.getElementById('novo-membro-cargo').value.trim();
  const whatsapp = document.getElementById('novo-membro-whatsapp').value.trim();
  const email = document.getElementById('novo-membro-email').value.trim();
  const arquivoInput = document.getElementById('novo-membro-foto');
  const statusEl = document.getElementById('novo-membro-foto-status');

  if (!nome) { alert('Preencha o nome.'); return; }

  function salvar(fotoUrl, deleteUrl) {
    db.collection('equipe').add({ nome, cargo, whatsapp, email, foto: fotoUrl || '', fotoDeleteUrl: deleteUrl || '' }).then(function() {
      document.getElementById('novo-membro-nome').value = '';
      document.getElementById('novo-membro-cargo').value = '';
      document.getElementById('novo-membro-whatsapp').value = '';
      document.getElementById('novo-membro-email').value = '';
      arquivoInput.value = '';
      statusEl.textContent = '';
      carregarEquipe();
    }).catch(function(error) {
      alert('Erro ao adicionar: ' + error.message);
    });
  }

  const arquivo = arquivoInput.files[0];
  if (arquivo) {
    statusEl.textContent = 'Enviando foto...';
    uploadImagemImgBB(arquivo).then(function(resultado) {
      statusEl.textContent = 'Foto enviada!';
      salvar(resultado.url, resultado.deleteUrl);
    }).catch(function(erro) {
      statusEl.textContent = '';
      alert('Erro ao enviar a foto: ' + erro);
    });
  } else {
    salvar('', '');
  }
}

function editarMembro(id) {
  db.collection('equipe').doc(id).get().then(function(doc) {
    const data = doc.data();
    const novoNome = prompt('Nome:', data.nome);
    if (novoNome === null) return;
    const novoCargo = prompt('Cargo:', data.cargo);
    if (novoCargo === null) return;
    const novoWhatsapp = prompt('WhatsApp:', data.whatsapp);
    if (novoWhatsapp === null) return;
    const novoEmail = prompt('E-mail:', data.email);
    if (novoEmail === null) return;

    db.collection('equipe').doc(id).update({
      nome: novoNome,
      cargo: novoCargo,
      whatsapp: novoWhatsapp,
      email: novoEmail
    }).then(carregarEquipe);
  });
}

function apagarMembro(id) {
  if (!confirm('Tem certeza que quer apagar esta pessoa da equipe?')) return;
  db.collection('equipe').doc(id).get().then(function(doc) {
    const data = doc.data();
    if (data && data.fotoDeleteUrl) {
      tentarApagarDoImgBB(data.fotoDeleteUrl);
    }
    return db.collection('equipe').doc(id).delete();
  }).then(carregarEquipe);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
