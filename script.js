"use strict";

// PRODUTOS PADRÃO
const defaultProducts = [
  { id: 1, name: "Classic Gold", category: "hamburgueres", price: 29.90 },
  { id: 2, name: "Double Premium", category: "hamburgueres", price: 36.90 },
  { id: 3, name: "Bacon Supreme", category: "hamburgueres", price: 34.90 },
  { id: 4, name: "Batata Cheddar & Bacon", category: "batatas", price: 22.90 },
  { id: 5, name: "Refrigerante Lata", category: "bebidas", price: 6.00 }
];

// VENDAS INICIAIS DE EXEMPLO (Evita que a tabela surja vazia)
const defaultVendas = [
  { id: 101, data: "27/10/2026", garcom: "Garçom João", valor: 89.70, comissao: 8.97 },
  { id: 102, data: "27/10/2026", garcom: "Gestor Admin", valor: 52.80, comissao: 5.28 }
];

const state = {
  products: JSON.parse(localStorage.getItem("products")) || defaultProducts,
  cart: new Map(),
  user: JSON.parse(localStorage.getItem("user")) || null,
  users: JSON.parse(localStorage.getItem("users")) || [
    { id: 1, nome: "Garçom João", email: "garcom@iot.com", role: "funcionario" },
    { id: 2, nome: "Gestor Admin", email: "admin@iot.com", role: "admin" }
  ],
  reservas: JSON.parse(localStorage.getItem("reservas")) || [],
  vendas: JSON.parse(localStorage.getItem("vendas")) || defaultVendas
};

// ELEMENTOS DO DOM
const grid = document.getElementById("products-grid");
const cartPanel = document.getElementById("cart-panel");
const overlay = document.getElementById("overlay");
const cartItems = document.getElementById("cart-items");
const cartCount = document.getElementById("cart-count");
const cartTotal = document.getElementById("cart-total");

const money = value => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// CONTROLO DE ACESSO (RBAC) E NAVEGAÇÃO
function switchTab(tabId) {
  if (tabId === 'gestao-tab') {
    if (!state.user || !['admin', 'funcionario'].includes(state.user.role)) {
      alert("Acesso Negado! Esta área é exclusiva para Administradores e Funcionários.");
      return;
    }
  }

  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  
  const selectedTab = document.getElementById(tabId);
  if (selectedTab) selectedTab.classList.add('active');
  if (event && event.target && event.target.classList.contains('nav-btn')) {
    event.target.classList.add('active');
  }
}

// AUTENTICAÇÃO E RBAC (MÁXIMO 2 ADMINS)
function openAuthModal() { document.getElementById('auth-modal').style.display = 'block'; }
function closeAuthModal() { document.getElementById('auth-modal').style.display = 'none'; }

function executarAuth(tipo) {
  const email = document.getElementById("auth-email").value;
  const role = document.getElementById("auth-role").value;
  const nome = document.getElementById("auth-nome").value || email.split("@")[0];

  if (!email) return alert("Informe um e-mail válido.");

  const totalAdmins = state.users.filter(u => u.role === "admin").length;
  let usuario = state.users.find(u => u.email === email);

  if (tipo === "cadastro") {
    if (role === "admin" && totalAdmins >= 2 && (!usuario || usuario.role !== "admin")) {
      return alert("Limite atingido! O sistema permite no máximo 2 Administradores.");
    }

    if (!usuario) {
      usuario = { id: Date.now(), nome, email, role };
      state.users.push(usuario);
      localStorage.setItem("users", JSON.stringify(state.users));
    } else {
      return alert("Este e-mail já está registado. Faça Login.");
    }
  } else {
    if (!usuario) {
      if (role === "admin" && totalAdmins >= 2) {
        return alert("Limite atingido! Não é possível entrar como novo Administrador (máximo 2).");
      }
      usuario = { id: Date.now(), nome, email, role };
    }
  }

  const jwtToken = btoa(JSON.stringify({ id: usuario.id, role: usuario.role, exp: Date.now() + 3600000 }));
  localStorage.setItem("jwt_token", jwtToken);
  localStorage.setItem("user", JSON.stringify(usuario));
  state.user = usuario;

  closeAuthModal();
  atualizarInterface();
}

function logout() {
  localStorage.removeItem("jwt_token");
  localStorage.removeItem("user");
  state.user = null;
  atualizarInterface();
  switchTab('cardapio-tab');
}

function atualizarInterface() {
  const userDisplay = document.getElementById("user-display");
  const authBtn = document.getElementById("auth-btn");
  const gestaoBtn = document.getElementById("gestao-tab-btn");

  if (state.user) {
    if (userDisplay) userDisplay.textContent = `${state.user.nome} (${state.user.role.toUpperCase()})`;
    if (authBtn) {
      authBtn.textContent = "Sair";
      authBtn.onclick = logout;
    }

    if (['admin', 'funcionario'].includes(state.user.role)) {
      if (gestaoBtn) gestaoBtn.style.display = "inline-block";
    } else {
      if (gestaoBtn) gestaoBtn.style.display = "none";
    }
  } else {
    if (userDisplay) userDisplay.textContent = "Visitante";
    if (authBtn) {
      authBtn.textContent = "Login / Cadastro";
      authBtn.onclick = openAuthModal;
    }
    if (gestaoBtn) gestaoBtn.style.display = "none";
  }

  carregarGarcons();
  renderReservas();
  renderFinanceiro();
}

// CADASTRAR PRODUTO (FUNCIONALIDADE ADMIN)
function cadastrarProduto(event) {
  event.preventDefault();
  if (!state.user || state.user.role !== 'admin') {
    return alert("Apenas Administradores podem cadastrar produtos!");
  }

  const nome = document.getElementById("p-nome").value;
  const categoria = document.getElementById("p-categoria").value;
  const preco = parseFloat(document.getElementById("p-preco").value);

  const novoProduto = { id: Date.now(), name: nome, category: categoria, price: preco };
  state.products.push(novoProduto);
  localStorage.setItem("products", JSON.stringify(state.products));

  alert("Produto cadastrado com sucesso!");
  document.getElementById("form-add-produto").reset();
  renderProducts();
}

// AGENDAMENTO DE MESAS (SEXTA, SÁBADO E DOMINGO)
function agendarMesa(event) {
  event.preventDefault();
  const data = document.getElementById("reserva-data").value;
  const hora = document.getElementById("reserva-hora").value;
  const pessoas = document.getElementById("reserva-pessoas").value;

  const diaSemana = new Date(data + "T00:00:00").getDay();
  if (![0, 5, 6].includes(diaSemana)) {
    return alert("Agendamentos são permitidos apenas para Sextas, Sábados e Domingos.");
  }

  const novaReserva = { id: Date.now(), data, hora, pessoas, cliente: state.user?.nome || "Cliente" };
  state.reservas.push(novaReserva);
  localStorage.setItem("reservas", JSON.stringify(state.reservas));
  alert("Reserva realizada com sucesso!");
  renderReservas();
}

function renderReservas() {
  const lista = document.getElementById("lista-reservas");
  if (!lista) return;
  lista.innerHTML = state.reservas.map(r => 
    `<li><strong>${r.data}</strong> às ${r.hora} - ${r.pessoas} pessoa(s) (${r.cliente})</li>`
  ).join('');
}

// REGISTRO DE VENDAS E EXIBIÇÃO NA TABELA FINANCEIRA
function carregarGarcons() {
  const selectGarcom = document.getElementById("cart-garcom");
  if (!selectGarcom) return;

  const garcons = state.users.filter(u => u.role === "funcionario" || u.role === "admin");
  selectGarcom.innerHTML = `<option value="">Sem garçom (Balcão)</option>` + 
    garcons.map(g => `<option value="${g.nome}">${g.nome}</option>`).join("");
}

function registrarVenda(valorTotal, garcomNome) {
  const comissao = garcomNome ? valorTotal * 0.10 : 0;
  const venda = {
    id: Date.now(),
    data: new Date().toLocaleDateString("pt-BR"),
    valor: valorTotal,
    garcom: garcomNome || "Nenhum",
    comissao: comissao
  };

  state.vendas.push(venda);
  localStorage.setItem("vendas", JSON.stringify(state.vendas));
  renderFinanceiro();
}

function renderFinanceiro() {
  const tabela = document.getElementById("tabela-financeiro");
  const totalVendas = document.getElementById("total-vendas");
  const totalComissoes = document.getElementById("total-comissoes");
  const totalQtd = document.getElementById("total-qtd-vendas");

  if (!tabela) return;

  if (state.vendas.length === 0) {
    tabela.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px;">Nenhum pedido registado ainda.</td></tr>`;
  } else {
    tabela.innerHTML = state.vendas.map(v => `
      <tr>
        <td>${v.data}</td>
        <td>${v.garcom}</td>
        <td>${money(v.valor)}</td>
        <td>${money(v.comissao)}</td>
      </tr>
    `).join("");
  }

  const faturamento = state.vendas.reduce((acc, v) => acc + v.valor, 0);
  const comissoes = state.vendas.reduce((acc, v) => acc + v.comissao, 0);

  if (totalVendas) totalVendas.textContent = money(faturamento);
  if (totalComissoes) totalComissoes.textContent = money(comissoes);
  if (totalQtd) totalQtd.textContent = state.vendas.length;
}

// CARDÁPIO E CARRINHO
function renderProducts(category = "todos") {
  if (!grid) return;
  const filtered = category === "todos" ? state.products : state.products.filter(p => p.category === category);

  grid.innerHTML = filtered.map(p => `
    <article class="product-card">
      <h3>${p.name}</h3>
      <span class="product-price">${money(p.price)}</span>
      <div style="margin-top: 10px;">
        <button class="gold-button" data-add="${p.id}">+ ADICIONAR</button>
      </div>
    </article>
  `).join("");
}

function renderCart() {
  const entries = [...state.cart.entries()];
  if (cartCount) cartCount.textContent = entries.reduce((s, [, q]) => s + q, 0);

  const subtotal = entries.reduce((sum, [id, qty]) => {
    const prod = state.products.find(p => p.id === id);
    return sum + (prod ? prod.price * qty : 0);
  }, 0);

  const garcom = document.getElementById("cart-garcom")?.value;
  const taxa = garcom ? subtotal * 0.10 : 0;

  if (cartTotal) cartTotal.textContent = money(subtotal + taxa);

  if (cartItems) {
    if (entries.length === 0) {
      cartItems.innerHTML = '<p class="empty-cart">Seu carrinho está vazio.</p>';
      return;
    }

    cartItems.innerHTML = entries.map(([id, quantity]) => {
      const product = state.products.find(item => item.id === id);
      return `
        <div class="cart-item">
          <div>
            <h3>${product.name}</h3>
            <p>${money(product.price * quantity)}</p>
            <span>Qtd: ${quantity}</span>
          </div>
        </div>
      `;
    }).join("");
  }
}

// INICIALIZAÇÃO
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("year").textContent = new Date().getFullYear();

  if (!localStorage.getItem("vendas")) {
    localStorage.setItem("vendas", JSON.stringify(state.vendas));
  }

  renderProducts();
  renderCart();
  atualizarInterface();

  if (grid) {
    grid.addEventListener("click", e => {
      const btn = e.target.closest("[data-add]");
      if (btn) {
        const id = Number(btn.dataset.add);
        state.cart.set(id, (state.cart.get(id) || 0) + 1);
        renderCart();
      }
    });
  }

  document.getElementById("open-cart")?.addEventListener("click", () => {
    cartPanel?.classList.add("open");
    overlay?.classList.add("visible");
  });

  const closeCart = () => {
    cartPanel?.classList.remove("open");
    overlay?.classList.remove("visible");
  };

  document.getElementById("close-cart")?.addEventListener("click", closeCart);
  overlay?.addEventListener("click", closeCart);

  const checkoutBtn = document.getElementById("checkout-button");
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", () => {
      if (state.cart.size === 0) return alert("Carrinho vazio!");
      
      const subtotal = [...state.cart.entries()].reduce((s, [id, q]) => s + state.products.find(p => p.id === id).price * q, 0);
      const garcom = document.getElementById("cart-garcom")?.value;

      registrarVenda(subtotal, garcom);
      alert("Pedido finalizado com sucesso!");
      state.cart.clear();
      renderCart();
      closeCart();
    });
  }

  document.querySelector(".categories")?.addEventListener("click", event => {
    const button = event.target.closest("[data-category]");
    if (!button) return;

    document.querySelectorAll(".category").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    renderProducts(button.dataset.category);
  });
});