// ===== ENVIO DE FOTOS =====
// A chave do ImgBB NÃO mora mais aqui. Código de site é público: quem
// abre o site, lê. A foto agora vai para o nosso servidor, e é ele que
// fala com o ImgBB, com a chave guardada em segredo. Além disso, o
// servidor só aceita envio de quem está logado neste painel.
const SERVIDOR_IMAGENS = 'https://fortaleza-imagens.fortalezadigitalsecurity.workers.dev';

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

// Encolhe a foto no proprio celular antes de mandar. Foto de celular tem
// 4 ou 5 MB e 4000 pixels de largura — mais do que qualquer tela precisa.
// Reduzindo aqui, o envio fica varias vezes mais rapido e a loja carrega
// mais leve. Se qualquer coisa der errado, manda o arquivo original.
const LARGURA_MAXIMA_FOTO = 1600;

function encolherFoto(arquivo) {
  return new Promise(function(resolve) {
    if (!arquivo || !arquivo.type || arquivo.type.indexOf('image/') !== 0) { resolve(arquivo); return; }
    if (arquivo.type === 'image/gif') { resolve(arquivo); return; }

    const leitor = new FileReader();
    leitor.onload = function() {
      const img = new Image();
      img.onload = function() {
        try {
          if (img.width <= LARGURA_MAXIMA_FOTO && arquivo.size < 900000) { resolve(arquivo); return; }
          const escala = Math.min(1, LARGURA_MAXIMA_FOTO / img.width);
          const tela = document.createElement('canvas');
          tela.width = Math.round(img.width * escala);
          tela.height = Math.round(img.height * escala);
          tela.getContext('2d').drawImage(img, 0, 0, tela.width, tela.height);
          tela.toBlob(function(menor) {
            if (!menor || menor.size >= arquivo.size) { resolve(arquivo); return; }
            resolve(new File([menor], (arquivo.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg',
                             { type: 'image/jpeg' }));
          }, 'image/jpeg', 0.85);
        } catch (e) { resolve(arquivo); }
      };
      img.onerror = function() { resolve(arquivo); };
      img.src = leitor.result;
    };
    leitor.onerror = function() { resolve(arquivo); };
    leitor.readAsDataURL(arquivo);
  });
}

function uploadImagemImgBB(arquivoOriginal) {
  return new Promise(function(resolve, reject) {
    if (!arquivoOriginal) { reject('Nenhum arquivo selecionado.'); return; }
    if (!auth || !auth.currentUser) { reject('Faça login no painel antes de enviar fotos.'); return; }

    Promise.all([auth.currentUser.getIdToken(), encolherFoto(arquivoOriginal)])
      .then(function(partes) {
      const token = partes[0];
      const arquivo = partes[1];
      const formData = new FormData();
      formData.append('image', arquivo);
      return fetch(SERVIDOR_IMAGENS, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        body: formData
      });
    })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data && data.ok && data.url) {
          resolve({ url: data.url, thumbUrl: data.thumbUrl || data.url, deleteUrl: data.deleteUrl || '' });
        } else {
          reject((data && data.motivo) || 'Erro ao enviar imagem.');
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
    carregarAplicativos();
    carregarContato();
    carregarEquipe();
  } else {
    document.getElementById('login-screen').style.display = 'block';
    document.getElementById('painel').style.display = 'none';
    document.getElementById('admin-tabs').style.display = 'none';
  }
});

function mostrarAba(nome) {
  ['conteudo', 'portfolio', 'aplicativos', 'contato', 'conta'].forEach(function(aba) {
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
      if (data.tipo === 'app') return; // apps ficam na aba Apps
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

// ===================== LOJA DE APLICATIVOS (APKs) =====================
// Os apps ficam na coleção "portfolio" com tipo: 'app' — assim usam as
// mesmas regras de acesso do portfólio, que já funcionam.
// O arquivo APK vai para a pasta /apks deste mesmo repositório do GitHub
// (de onde o site é publicado), usando uma chave do GitHub que fica
// guardada SÓ no aparelho do dono (nunca no código nem no Firestore).
const GH_API = 'https://api.github.com';
const GH_REPO = 'dasilvagonchoroskie-cpu/fortaleza-digital-site';
const GH_TOKEN_CHAVE = 'fortaleza_github_token';
const SITE_URL = 'https://fortalezadigitalsecurity.com.br/';
const APK_LIMITE_BYTES = 95 * 1024 * 1024; // GitHub não aceita arquivo acima de 100 MB

let APPS_ADMIN = {};
let appEditandoId = null;

function lerTokenGitHub() {
  try { return localStorage.getItem(GH_TOKEN_CHAVE) || ''; } catch (e) { return ''; }
}

function atualizarStatusToken() {
  document.getElementById('gh-status').textContent = lerTokenGitHub()
    ? 'Chave configurada neste aparelho. Já dá para enviar APKs.'
    : 'Nenhuma chave neste aparelho. Sem ela dá para cadastrar o app, mas não para enviar o arquivo APK.';
}

function ghMensagemErro(status, dados) {
  if (status === 401) return 'A chave do GitHub não foi aceita (vencida ou copiada errada). Crie uma nova e salve de novo.';
  if (status === 403 || status === 404) return 'A chave do GitHub não tem permissão para gravar no site. Confira o passo das permissões: Contents ("Conteúdo") em Read and write ("Leitura e escrita").';
  return 'O GitHub respondeu erro ' + status + ((dados && dados.message) ? ': ' + dados.message : '');
}

async function ghReq(token, metodo, caminho, corpo) {
  const res = await fetch(GH_API + caminho, {
    method: metodo,
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  const texto = await res.text();
  let dados = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch (e) {}
  if (!res.ok) throw new Error(ghMensagemErro(res.status, dados));
  return dados;
}

async function salvarTokenGitHub() {
  const campo = document.getElementById('gh-token');
  const token = campo.value.trim();
  if (!token) { alert('Cole a chave primeiro.'); return; }
  document.getElementById('gh-status').textContent = 'Conferindo a chave...';
  try {
    await ghReq(token, 'GET', '/repos/' + GH_REPO);
    localStorage.setItem(GH_TOKEN_CHAVE, token);
    campo.value = '';
    atualizarStatusToken();
    alert('Chave salva! Agora você já pode enviar APKs.');
  } catch (e) {
    document.getElementById('gh-status').textContent = e.message;
  }
}

function removerTokenGitHub() {
  if (!confirm('Remover a chave do GitHub deste aparelho?')) return;
  try { localStorage.removeItem(GH_TOKEN_CHAVE); } catch (e) {}
  atualizarStatusToken();
}

function lerArquivoBase64(arquivo) {
  return new Promise(function(resolve, reject) {
    const leitor = new FileReader();
    leitor.onload = function() { resolve(String(leitor.result).split(',')[1]); };
    leitor.onerror = function() { reject(new Error('Não consegui ler o arquivo APK.')); };
    leitor.readAsDataURL(arquivo);
  });
}

// Envia o conteúdo do APK ao GitHub mostrando o progresso
function ghEnviarBlob(token, base64, aoProgredir) {
  return new Promise(function(resolve, reject) {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', GH_API + '/repos/' + GH_REPO + '/git/blobs');
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    xhr.setRequestHeader('Accept', 'application/vnd.github+json');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.upload.onprogress = function(e) { if (e.lengthComputable && aoProgredir) aoProgredir(e.loaded / e.total); };
    xhr.onload = function() {
      let dados = null;
      try { dados = JSON.parse(xhr.responseText); } catch (e) {}
      if (xhr.status === 201 && dados && dados.sha) resolve(dados.sha);
      else reject(new Error(ghMensagemErro(xhr.status, dados)));
    };
    xhr.onerror = function() { reject(new Error('A conexão com o GitHub caiu durante o envio. Tente de novo com internet mais estável.')); };
    xhr.send(JSON.stringify({ content: base64, encoding: 'base64' }));
  });
}

// Grava (sha) ou apaga (sha: null) arquivos do site em um único commit
async function ghCommit(token, mudancas, mensagem) {
  const repo = await ghReq(token, 'GET', '/repos/' + GH_REPO);
  const ramo = repo.default_branch || 'main';
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const ref = await ghReq(token, 'GET', '/repos/' + GH_REPO + '/git/ref/heads/' + ramo);
    const commitAtual = ref.object.sha;
    const commit = await ghReq(token, 'GET', '/repos/' + GH_REPO + '/git/commits/' + commitAtual);
    const arvore = await ghReq(token, 'POST', '/repos/' + GH_REPO + '/git/trees', {
      base_tree: commit.tree.sha,
      tree: mudancas.map(function(m) { return { path: m.path, mode: '100644', type: 'blob', sha: m.sha }; })
    });
    const novo = await ghReq(token, 'POST', '/repos/' + GH_REPO + '/git/commits', {
      message: mensagem, tree: arvore.sha, parents: [commitAtual]
    });
    try {
      await ghReq(token, 'PATCH', '/repos/' + GH_REPO + '/git/refs/heads/' + ramo, { sha: novo.sha });
      return;
    } catch (e) {
      if (tentativa === 2) throw e; // alguém gravou ao mesmo tempo: tenta de novo
    }
  }
}

function slugApp(texto) {
  return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'app';
}

function caminhoApkUnico(nome, idAtual) {
  const base = 'apks/' + slugApp(nome);
  const usados = Object.keys(APPS_ADMIN).filter(function(id) { return id !== idAtual; })
    .map(function(id) { return APPS_ADMIN[id].apkCaminho; });
  let caminho = base + '.apk', n = 2;
  while (usados.indexOf(caminho) !== -1) { caminho = base + '-' + n + '.apk'; n++; }
  return caminho;
}

function lerPreco(texto) {
  let t = String(texto || '').replace(/R\$|\s/gi, '');
  if (!t) return null;
  if (t.indexOf(',') !== -1) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  if (isNaN(n) || n < 0) throw new Error('preço inválido');
  return Math.round(n * 100) / 100;
}

function precoTexto(d) {
  if (typeof d.preco === 'number' && d.preco > 0) return d.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (d.preco === 0) return 'Grátis';
  return 'Consulte';
}

function tamanhoTexto(bytes) {
  return bytes ? (bytes / 1048576).toFixed(1).replace('.', ',') + ' MB' : '';
}

function ordenarApps(a, b) {
  const oa = Number(a.ordem) || 0, ob = Number(b.ordem) || 0;
  return oa !== ob ? oa - ob : String(a.nome || '').localeCompare(String(b.nome || ''));
}

function carregarAplicativos() {
  atualizarStatusToken();
  const container = document.getElementById('lista-aplicativos');
  db.collection('portfolio').where('tipo', '==', 'app').get().then(function(snapshot) {
    APPS_ADMIN = {};
    const lista = [];
    snapshot.forEach(function(doc) {
      APPS_ADMIN[doc.id] = doc.data();
      lista.push(Object.assign({ _id: doc.id }, doc.data()));
    });
    lista.sort(ordenarApps);
    if (!lista.length) {
      container.innerHTML = '<p class="admin-hint">Nenhum aplicativo cadastrado ainda. Use o formulário abaixo.</p>';
      return;
    }
    container.innerHTML = '';
    lista.forEach(function(d) {
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <div class="item-info">
          <strong>${escapeHtml(d.nome || '')}${d.ativo === false ? ' (escondido do site)' : ''}</strong>
          <span>${escapeHtml(precoTexto(d))} · versão ${escapeHtml(d.versao || '-')} · ${d.apkCaminho ? 'APK ' + tamanhoTexto(d.apkTamanho) : 'sem APK enviado'}</span>
        </div>
        <div class="item-actions">
          <button class="admin-btn secondary" onclick="editarAplicativo('${d._id}')">Editar</button>
          ${d.apkCaminho ? `<button class="admin-btn secondary" onclick="copiarLinkApk('${d._id}')">Copiar link do APK</button>` : ''}
          <button class="admin-btn danger" onclick="apagarAplicativo('${d._id}')">Apagar</button>
        </div>
      `;
      container.appendChild(row);
    });
  }).catch(function(e) {
    container.innerHTML = '<p class="admin-hint">Erro ao carregar: ' + escapeHtml(e.message) + '</p>';
  });
}

function statusApp(texto) { document.getElementById('app-status').textContent = texto; }

function progressoApp(fracao) {
  const caixa = document.getElementById('app-progresso');
  if (fracao === null) { caixa.style.display = 'none'; return; }
  caixa.style.display = 'block';
  document.getElementById('app-progresso-barra').style.width = Math.round(fracao * 100) + '%';
  statusApp('Enviando o APK... ' + Math.round(fracao * 100) + '%');
}

function limparFormularioApp(manterStatus) {
  appEditandoId = null;
  ['app-nome', 'app-descricao', 'app-preco', 'app-preco-detalhe', 'app-versao', 'app-ordem', 'app-apk', 'app-icone', 'app-prints']
    .forEach(function(id) { document.getElementById(id).value = ''; });
  document.getElementById('app-ativo').checked = true;
  document.getElementById('app-download').checked = false;
  document.getElementById('app-apk-info').textContent = '';
  document.getElementById('app-prints-info').textContent = '';
  document.getElementById('app-form-titulo').textContent = 'Adicionar aplicativo';
  document.getElementById('app-salvar-btn').textContent = 'Adicionar aplicativo';
  document.getElementById('app-cancelar-btn').style.display = 'none';
  if (!manterStatus) statusApp('');
}

function editarAplicativo(id) {
  const d = APPS_ADMIN[id];
  if (!d) return;
  limparFormularioApp();
  appEditandoId = id;
  document.getElementById('app-nome').value = d.nome || '';
  document.getElementById('app-descricao').value = d.descricao || '';
  document.getElementById('app-preco').value = typeof d.preco === 'number' ? String(d.preco).replace('.', ',') : '';
  document.getElementById('app-preco-detalhe').value = d.precoDetalhe || '';
  document.getElementById('app-versao').value = d.versao || '';
  document.getElementById('app-ordem').value = d.ordem || '';
  document.getElementById('app-ativo').checked = d.ativo !== false;
  document.getElementById('app-download').checked = !!d.mostrarDownload;
  document.getElementById('app-apk-info').textContent = d.apkCaminho
    ? 'APK atual: ' + (d.apkNomeOriginal || d.apkCaminho) + ' (' + tamanhoTexto(d.apkTamanho) + '). Escolha outro arquivo só se quiser trocar pela versão nova.'
    : 'Este app ainda não tem APK enviado.';
  const qtd = Array.isArray(d.fotos) ? d.fotos.length : 0;
  document.getElementById('app-prints-info').textContent = qtd
    ? 'Tem ' + qtd + ' print(s). Se escolher novos, eles substituem os atuais.' : '';
  document.getElementById('app-form-titulo').textContent = 'Editar aplicativo';
  document.getElementById('app-salvar-btn').textContent = 'Salvar alterações';
  document.getElementById('app-cancelar-btn').style.display = 'inline-block';
  document.getElementById('app-form-box').scrollIntoView({ behavior: 'smooth' });
}

async function salvarAplicativo() {
  const nome = document.getElementById('app-nome').value.trim();
  if (!nome) { alert('Preencha o nome do aplicativo.'); return; }
  let preco;
  try { preco = lerPreco(document.getElementById('app-preco').value); }
  catch (e) { alert('Preço inválido. Use só números, ex.: 49,90'); return; }

  const apk = document.getElementById('app-apk').files[0];
  const icone = document.getElementById('app-icone').files[0];
  const prints = document.getElementById('app-prints').files;
  const token = lerTokenGitHub();
  const anterior = appEditandoId ? APPS_ADMIN[appEditandoId] : null;

  if (apk) {
    if (!/\.apk$/i.test(apk.name)) { alert('O arquivo escolhido não é um APK.'); return; }
    if (apk.size > APK_LIMITE_BYTES) { alert('Esse APK tem ' + tamanhoTexto(apk.size) + '. O limite é 95 MB.'); return; }
    if (!token) { alert('Para enviar o APK, salve antes a chave do GitHub (no fim desta tela).'); return; }
  }

  const versao = document.getElementById('app-versao').value.trim();
  const dados = {
    tipo: 'app',
    nome: nome,
    descricao: document.getElementById('app-descricao').value.trim(),
    preco: preco,
    precoDetalhe: document.getElementById('app-preco-detalhe').value.trim(),
    versao: versao,
    ordem: Number(document.getElementById('app-ordem').value) || 0,
    ativo: document.getElementById('app-ativo').checked,
    mostrarDownload: document.getElementById('app-download').checked,
    atualizadoEm: Date.now()
  };

  const botao = document.getElementById('app-salvar-btn');
  botao.disabled = true;
  try {
    if (icone) {
      statusApp('Enviando o ícone...');
      const r = await uploadImagemImgBB(icone);
      dados.icone = r.url;
      dados.iconeDelete = r.deleteUrl || '';
      if (anterior && anterior.iconeDelete) tentarApagarDoImgBB(anterior.iconeDelete);
    }
    if (prints && prints.length) {
      statusApp('Enviando ' + prints.length + ' print(s)...');
      dados.fotos = await uploadVariasImagensImgBB(prints);
      if (anterior && Array.isArray(anterior.fotos)) anterior.fotos.forEach(function(f) { tentarApagarDoImgBB(f.deleteUrl); });
    }
    if (apk) {
      const caminho = (anterior && anterior.apkCaminho) || caminhoApkUnico(nome, appEditandoId);
      statusApp('Preparando o APK...');
      const base64 = await lerArquivoBase64(apk);
      const sha = await ghEnviarBlob(token, base64, progressoApp);
      statusApp('Publicando o APK no site...');
      await ghCommit(token, [{ path: caminho, sha: sha }], 'Loja de apps: ' + nome + (versao ? ' ' + versao : ''));
      dados.apkCaminho = caminho;
      dados.apkTamanho = apk.size;
      dados.apkNomeOriginal = apk.name;
      dados.apkAtualizadoEm = Date.now();
    }
    statusApp('Salvando os dados...');
    if (appEditandoId) {
      await db.collection('portfolio').doc(appEditandoId).update(dados);
    } else {
      dados.criadoEm = Date.now();
      if (!dados.fotos) dados.fotos = [];
      await db.collection('portfolio').add(dados);
    }
    limparFormularioApp(true);
    statusApp(apk ? 'Pronto! O APK fica disponível para baixar em 1 a 2 minutos.' : 'Pronto! Aplicativo salvo.');
    carregarAplicativos();
  } catch (e) {
    statusApp('');
    alert('Não deu certo: ' + (e && e.message ? e.message : e));
  } finally {
    botao.disabled = false;
    progressoApp(null);
  }
}

function copiarLinkApk(id) {
  const d = APPS_ADMIN[id];
  if (!d || !d.apkCaminho) return;
  const url = SITE_URL + d.apkCaminho + '?v=' + (d.apkAtualizadoEm || '');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function() {
      alert('Link do APK copiado! É só colar no WhatsApp do cliente.\n\n' + url);
    }).catch(function() { prompt('Copie o link do APK:', url); });
  } else {
    prompt('Copie o link do APK:', url);
  }
}

async function apagarAplicativo(id) {
  const d = APPS_ADMIN[id];
  if (!d) return;
  if (!confirm('Apagar o aplicativo "' + (d.nome || '') + '" da loja?')) return;
  try {
    await db.collection('portfolio').doc(id).delete();
    if (d.iconeDelete) tentarApagarDoImgBB(d.iconeDelete);
    if (Array.isArray(d.fotos)) d.fotos.forEach(function(f) { tentarApagarDoImgBB(f.deleteUrl); });
    if (appEditandoId === id) limparFormularioApp();
    if (d.apkCaminho) {
      const token = lerTokenGitHub();
      if (token) {
        try { await ghCommit(token, [{ path: d.apkCaminho, sha: null }], 'Loja de apps: remove ' + (d.nome || '')); }
        catch (e) { alert('O app saiu da loja, mas não consegui apagar o arquivo APK do GitHub: ' + e.message); }
      } else {
        alert('O app saiu da loja. O arquivo APK continua guardado no GitHub porque não há chave do GitHub neste aparelho.');
      }
    }
    carregarAplicativos();
  } catch (e) {
    alert('Erro ao apagar: ' + e.message);
  }
}
