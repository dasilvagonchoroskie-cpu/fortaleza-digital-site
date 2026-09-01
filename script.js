document.getElementById('ano').textContent = new Date().getFullYear();

// Carrega os textos principais do site
db.collection('conteudo').limit(1).get().then(function(snapshot) {
  if (snapshot.empty) return;
  const data = snapshot.docs[0].data();
  if (data.eyebrow) document.getElementById('hero-eyebrow').textContent = data.eyebrow;
  if (data.titulo) document.getElementById('hero-titulo').textContent = data.titulo;
  if (data.descricao) document.getElementById('hero-descricao').textContent = data.descricao;
  if (data.botao) document.getElementById('hero-botao').textContent = data.botao;
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
    if (data.titulo === 'Em breve' && !data.descricao) {
      return; // ignora o placeholder inicial
    }
    hasRealProject = true;
    const card = document.createElement('article');
    card.className = 'service-card';
    const imagemHtml = data.imagem ? `<img src="${escapeHtml(data.imagem)}" alt="${escapeHtml(data.titulo || '')}" class="portfolio-img">` : '';
    card.innerHTML = `
      ${imagemHtml}
      <h3>${escapeHtml(data.titulo || '')}</h3>
      <p>${escapeHtml(data.descricao || '')}</p>
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
