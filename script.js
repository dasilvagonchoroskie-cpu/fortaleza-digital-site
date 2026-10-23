document.getElementById('ano').textContent = new Date().getFullYear();

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

function aplicarTema(config) {
  const tema = TEMAS[config.tema] || TEMAS[TEMA_PADRAO];
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
  raiz.setProperty('--escala-fonte', config.escalaFonte || '1');
}

// Pega uma lista de fotos do projeto, seja no formato novo (fotos: [...])
// ou no formato antigo de projetos já cadastrados (imagem única) — assim
// nada que já estava publicado quebra.
function fotosDoProjeto(data) {
  if (Array.isArray(data.fotos) && data.fotos.length) return data.fotos;
  if (data.imagem) return [{ url: data.imagem }];
  return [];
}

let PROJETOS_CACHE = {};

function abrirLightbox(id) {
  const data = PROJETOS_CACHE[id];
  if (!data) return;
  document.getElementById('lightbox-titulo').textContent = data.titulo || '';
  document.getElementById('lightbox-descricao').textContent = data.descricao || '';
  document.getElementById('lightbox-meta').textContent = '';
  document.getElementById('lightbox-acoes').innerHTML = '';
  const fotos = fotosDoProjeto(data);
  const container = document.getElementById('lightbox-fotos');
  container.innerHTML = fotos.map(function(f) {
    return '<img src="' + escapeHtml(f.url) + '" alt="' + escapeHtml(data.titulo || '') + '">';
  }).join('');
  document.getElementById('lightbox').style.display = 'flex';
}

function fecharLightbox() {
  document.getElementById('lightbox').style.display = 'none';
}

// Carrega configurações visuais (tema/tamanho de texto) — aplica cache
// local na hora, depois confirma com o Firestore.
try {
  const emCache = localStorage.getItem(CACHE_CONFIG_CHAVE);
  if (emCache) aplicarTema(JSON.parse(emCache));
} catch (e) {}

db.collection('conteudo').limit(1).get().then(function(snapshot) {
  if (snapshot.empty) return;
  const data = snapshot.docs[0].data();
  if (data.eyebrow) document.getElementById('hero-eyebrow').textContent = data.eyebrow;
  if (data.titulo) document.getElementById('hero-titulo').textContent = data.titulo;
  if (data.descricao) document.getElementById('hero-descricao').textContent = data.descricao;
  if (data.botao) document.getElementById('hero-botao').textContent = data.botao;
  if (data.bannerUrl) {
    document.getElementById('banner-img').src = data.bannerUrl;
    document.getElementById('banner-wrap').style.display = 'block';
  }
  aplicarTema(data);
  try { localStorage.setItem(CACHE_CONFIG_CHAVE, JSON.stringify(data)); } catch (e) {}
}).catch(function(error) {
  console.error('Erro ao carregar textos:', error);
});

// Carrega os serviços do Firestore
db.collection('serviços').orderBy('ordem').get().then(function(snapshot) {
  const container = document.getElementById('servicos-lista');
  container.innerHTML = '';

  if (snapshot.empty) {
    container.innerHTML = '<p class="loading-msg">Nenhum serviço cadastrado ainda.</p>';
    return;
  }

  snapshot.forEach(function(doc) {
    const data = doc.data();
    const card = document.createElement('article');
    card.className = 'service-card';
    card.innerHTML = `
      <h3>${escapeHtml(data.titulo || '')}</h3>
      <p>${escapeHtml(data.descricao || '')}</p>
    `;
    container.appendChild(card);
  });
}).catch(function(error) {
  console.error('Erro ao carregar serviços:', error);
  document.getElementById('servicos-lista').innerHTML = '<p class="loading-msg">Não foi possível carregar os serviços agora.</p>';
});

// Carrega o portfólio do Firestore
db.collection('portfolio').get().then(function(snapshot) {
  const container = document.getElementById('portfolio-lista');
  container.innerHTML = '';

  if (snapshot.empty) {
    container.innerHTML = '<div class="portfolio-empty"><p>Os projetos entram aqui conforme forem ficando prontos.</p></div>';
    return;
  }

  let hasRealProject = false;

  snapshot.forEach(function(doc) {
    const data = doc.data();
    if (data.tipo === 'app') return; // apps da loja aparecem na seção Aplicativos
    if (data.titulo === 'Em breve' && !data.descricao) {
      return; // ignora o placeholder inicial
    }
    hasRealProject = true;
    PROJETOS_CACHE[doc.id] = data;

    const fotos = fotosDoProjeto(data);
    const capaHtml = fotos.length
      ? `<img src="${escapeHtml(fotos[0].url)}" alt="${escapeHtml(data.titulo || '')}" class="portfolio-img" loading="lazy">`
      : `<div class="portfolio-img-placeholder">Sem foto</div>`;
    const contagemHtml = fotos.length > 1 ? `<span class="portfolio-card-count">${fotos.length} fotos — toque para ver</span>` : '';

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'portfolio-card';
    card.onclick = function() { abrirLightbox(doc.id); };
    card.innerHTML = `
      ${capaHtml}
      <div class="portfolio-card-body">
        <h3>${escapeHtml(data.titulo || '')}</h3>
        <p>${escapeHtml(data.descricao || '')}</p>
        ${contagemHtml}
      </div>
    `;
    container.appendChild(card);
  });

  if (!hasRealProject) {
    container.innerHTML = '<div class="portfolio-empty"><p>Os projetos entram aqui conforme forem ficando prontos.</p></div>';
  }
}).catch(function(error) {
  console.error('Erro ao carregar portfólio:', error);
});

// Carrega a equipe (contatos adicionais) do Firestore
db.collection('equipe').get().then(function(snapshot) {
  if (snapshot.empty) return;

  const secao = document.getElementById('equipe');
  const container = document.getElementById('equipe-lista');
  container.innerHTML = '';

  snapshot.forEach(function(doc) {
    const data = doc.data();
    const card = document.createElement('article');
    card.className = 'team-card';
    const fotoHtml = data.foto
      ? `<img src="${escapeHtml(data.foto)}" alt="${escapeHtml(data.nome || '')}" class="team-photo">`
      : `<div class="team-photo team-photo-placeholder">${escapeHtml((data.nome || '?').charAt(0).toUpperCase())}</div>`;
    const linksHtml = `
      <div class="team-links">
        ${data.whatsapp ? `<a href="https://wa.me/${escapeHtml(data.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
        ${data.email ? `<a href="mailto:${escapeHtml(data.email)}">E-mail</a>` : ''}
      </div>
    `;
    card.innerHTML = `
      ${fotoHtml}
      <h3>${escapeHtml(data.nome || '')}</h3>
      <p class="team-cargo">${escapeHtml(data.cargo || '')}</p>
      ${linksHtml}
    `;
    container.appendChild(card);
  });

  secao.style.display = '';
}).catch(function(error) {
  console.error('Erro ao carregar equipe:', error);
});

// Carrega o WhatsApp e e-mail de contato
db.collection('contato').limit(1).get().then(function(snapshot) {
  if (snapshot.empty) return;
  const data = snapshot.docs[0].data();

  if (data.whatsapp) {
    const btn = document.getElementById('whatsapp-btn');
    btn.href = 'https://wa.me/' + data.whatsapp;
    btn.style.display = 'flex';
  }

  if (data.email) {
    const info = document.getElementById('contato-info');
    info.innerHTML = `<a href="mailto:${escapeHtml(data.email)}" class="contact-link">${escapeHtml(data.email)}</a>`;
  }
}).catch(function(error) {
  console.error('Erro ao carregar contato:', error);
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===================== LOJA DE APLICATIVOS =====================
// Os apps ficam na coleção "portfolio" com tipo: 'app' (cadastrados na aba Apps do painel).
let APPS_CACHE = {};
let WHATSAPP_LOJA = '';

function precoApp(d) {
  if (typeof d.preco === 'number' && d.preco > 0) return d.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (d.preco === 0) return 'Grátis';
  return 'Consulte';
}

function metaApp(d) {
  const partes = [];
  if (d.versao) partes.push('Versão ' + d.versao);
  if (d.apkTamanho) partes.push((d.apkTamanho / 1048576).toFixed(1).replace('.', ',') + ' MB');
  partes.push('Android');
  return partes.join(' · ');
}

function botoesApp(d) {
  let html = '';
  if (WHATSAPP_LOJA) {
    const msg = 'Olá! Tenho interesse no aplicativo ' + (d.nome || '') + ' (' + precoApp(d) + ') que vi no site.';
    const link = 'https://wa.me/' + WHATSAPP_LOJA + '?text=' + encodeURIComponent(msg);
    html += `<a class="app-btn" href="${escapeHtml(link)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${d.preco === 0 ? 'Pedir pelo WhatsApp' : 'Comprar pelo WhatsApp'}</a>`;
  }
  if (d.mostrarDownload && d.apkCaminho) {
    const apk = d.apkCaminho + '?v=' + (d.apkAtualizadoEm || '');
    html += `<a class="app-btn secundario" href="${escapeHtml(apk)}" download onclick="event.stopPropagation()">Baixar APK</a>`;
  }
  return html;
}

function abrirApp(id) {
  const d = APPS_CACHE[id];
  if (!d) return;
  document.getElementById('lightbox-titulo').textContent = d.nome || '';
  document.getElementById('lightbox-meta').textContent = precoApp(d) + (d.precoDetalhe ? ' — ' + d.precoDetalhe : '') + '  ·  ' + metaApp(d);
  document.getElementById('lightbox-descricao').textContent = d.descricao || '';
  document.getElementById('lightbox-acoes').innerHTML = botoesApp(d);
  const fotos = Array.isArray(d.fotos) ? d.fotos : [];
  document.getElementById('lightbox-fotos').innerHTML = fotos.map(function(f) {
    return '<img src="' + escapeHtml(f.url) + '" alt="' + escapeHtml(d.nome || '') + '" loading="lazy">';
  }).join('');
  document.getElementById('lightbox').style.display = 'flex';
}

Promise.all([
  db.collection('portfolio').where('tipo', '==', 'app').get(),
  db.collection('contato').limit(1).get()
]).then(function(resultados) {
  const contato = resultados[1];
  if (!contato.empty) WHATSAPP_LOJA = String(contato.docs[0].data().whatsapp || '').replace(/\D/g, '');

  const lista = [];
  resultados[0].forEach(function(doc) {
    const d = doc.data();
    if (d.ativo === false) return;
    APPS_CACHE[doc.id] = d;
    lista.push(Object.assign({ _id: doc.id }, d));
  });
  if (!lista.length) return;
  lista.sort(function(a, b) {
    const oa = Number(a.ordem) || 0, ob = Number(b.ordem) || 0;
    return oa !== ob ? oa - ob : String(a.nome || '').localeCompare(String(b.nome || ''));
  });

  const container = document.getElementById('apps-lista');
  container.innerHTML = '';
  lista.forEach(function(d) {
    const iconeHtml = d.icone
      ? `<img src="${escapeHtml(d.icone)}" alt="" class="app-icone" loading="lazy">`
      : `<div class="app-icone app-icone-vazio">${escapeHtml((d.nome || '?').charAt(0).toUpperCase())}</div>`;
    const card = document.createElement('div');
    card.className = 'app-card';
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
    card.onclick = function() { abrirApp(d._id); };
    card.innerHTML = `
      <div class="app-card-topo">
        ${iconeHtml}
        <div>
          <h3>${escapeHtml(d.nome || '')}</h3>
          <span class="app-meta">${escapeHtml(metaApp(d))}</span>
        </div>
      </div>
      <p class="app-desc">${escapeHtml(d.descricao || '')}</p>
      <p class="app-preco">${escapeHtml(precoApp(d))}${d.precoDetalhe ? ` <small>${escapeHtml(d.precoDetalhe)}</small>` : ''}</p>
      <div class="app-acoes">${botoesApp(d)}</div>
      <span class="portfolio-card-count">Toque para ver detalhes${Array.isArray(d.fotos) && d.fotos.length ? ' e prints' : ''}</span>
    `;
    container.appendChild(card);
  });
  document.getElementById('aplicativos').style.display = 'block';
  document.getElementById('nav-apps').style.display = '';
}).catch(function(error) {
  console.error('Erro ao carregar aplicativos:', error);
});
