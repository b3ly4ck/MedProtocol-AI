const state = {
  protocols: [],
  currentProtocol: null
};

function setStatus(text) {
  document.getElementById("status").textContent = text || "";
}

function show(view) {
  const ids = ["home", "list", "accept"];
  for (const id of ids) {
    const el = document.getElementById("view-" + id);
    if (id === view) {
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  }
}

async function api(path, opts) {
  const options = opts || {};
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  return data;
}

function createFieldRow(container) {
  const wrap = document.createElement("div");
  wrap.className = "field";

  const label = document.createElement("input");
  label.placeholder = "Название поля";
  label.className = "f-label";

  const key = document.createElement("input");
  key.placeholder = "Ключ (пример: pulse)";
  key.className = "f-key";

  const type = document.createElement("select");
  type.className = "f-type";
  const types = ["string", "number", "boolean", "date"];
  for (const item of types) {
    const o = document.createElement("option");
    o.value = item;
    o.textContent = item;
    type.appendChild(o);
  }

  const reqWrap = document.createElement("label");
  const req = document.createElement("input");
  req.type = "checkbox";
  req.className = "f-req";
  reqWrap.appendChild(req);
  reqWrap.appendChild(document.createTextNode(" Обязательно"));

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "secondary";
  remove.textContent = "Удалить поле";
  remove.onclick = function () {
    wrap.remove();
  };

  wrap.appendChild(label);
  wrap.appendChild(key);
  wrap.appendChild(type);
  wrap.appendChild(reqWrap);
  wrap.appendChild(remove);
  container.appendChild(wrap);
}

function createSection() {
  const root = document.getElementById("sections");
  const sec = document.createElement("div");
  sec.className = "section";

  const title = document.createElement("input");
  title.placeholder = "Название раздела";
  title.className = "s-title";

  const fields = document.createElement("div");
  fields.className = "s-fields";

  const addField = document.createElement("button");
  addField.type = "button";
  addField.className = "secondary";
  addField.textContent = "Добавить поле";
  addField.onclick = function () {
    createFieldRow(fields);
  };

  const removeSection = document.createElement("button");
  removeSection.type = "button";
  removeSection.className = "secondary";
  removeSection.textContent = "Удалить раздел";
  removeSection.onclick = function () {
    sec.remove();
  };

  sec.appendChild(title);
  sec.appendChild(addField);
  sec.appendChild(removeSection);
  sec.appendChild(fields);
  root.appendChild(sec);

  createFieldRow(fields);
}

function readProtocolForm() {
  const data = {};
  data.name = document.getElementById("p-name").value.trim();
  data.specialty = document.getElementById("p-specialty").value.trim() || "general";
  data.sections = [];

  const secList = document.querySelectorAll(".section");
  for (const secEl of secList) {
    const sec = {};
    sec.id = crypto.randomUUID();
    sec.title = secEl.querySelector(".s-title").value.trim() || "Раздел";
    sec.fields = [];

    const fieldList = secEl.querySelectorAll(".field");
    for (const row of fieldList) {
      const f = {};
      f.id = crypto.randomUUID();
      f.label = row.querySelector(".f-label").value.trim();
      f.key = row.querySelector(".f-key").value.trim();
      f.field_type = row.querySelector(".f-type").value;
      f.required = row.querySelector(".f-req").checked;
      if (f.label && f.key) {
        sec.fields.push(f);
      }
    }

    if (sec.fields.length > 0) {
      data.sections.push(sec);
    }
  }

  return data;
}

async function saveProtocol() {
  const data = readProtocolForm();
  if (!data.name) {
    setStatus("Введите название протокола");
    return;
  }
  if (data.sections.length === 0) {
    setStatus("Добавьте хотя бы один раздел и поле");
    return;
  }

  setStatus("Сохраняю протокол...");
  const result = await api("/protocols", {
    method: "POST",
    body: JSON.stringify(data)
  });

  if (result.status === "error") {
    setStatus("Ошибка сохранения");
  } else {
    setStatus("Протокол сохранен");
    await loadProtocols();
  }
}

async function loadProtocols() {
  setStatus("Загружаю протоколы...");
  const result = await api("/protocols");
  const items = result.items || [];
  state.protocols = items;
  renderProtocolList();
  renderProtocolSelect();
  setStatus("Протоколов: " + items.length);
}

function renderProtocolList() {
  const root = document.getElementById("protocol-list");
  root.innerHTML = "";
  if (state.protocols.length === 0) {
    root.textContent = "Пока пусто";
    return;
  }

  for (const item of state.protocols) {
    const box = document.createElement("div");
    box.className = "item";

    const left = document.createElement("div");
    left.innerHTML = "<b>" + item.name + "</b><br>" + (item.specialty || "general");

    const right = document.createElement("div");
    const open = document.createElement("button");
    open.className = "secondary";
    open.textContent = "Использовать";
    open.onclick = function () {
      state.currentProtocol = item;
      show("accept");
      renderProtocolSelect();
      buildVisitForm(item);
      setStatus("Открыт протокол: " + item.name);
    };

    right.appendChild(open);
    box.appendChild(left);
    box.appendChild(right);
    root.appendChild(box);
  }
}

function renderProtocolSelect() {
  const sel = document.getElementById("protocol-select");
  sel.innerHTML = "";
  for (const item of state.protocols) {
    const o = document.createElement("option");
    o.value = item.id;
    o.textContent = item.name;
    sel.appendChild(o);
  }

  if (state.currentProtocol) {
    sel.value = state.currentProtocol.id;
  }
}

async function loadSelectedProtocol() {
  const sel = document.getElementById("protocol-select");
  const id = sel.value;
  if (!id) {
    setStatus("Нет выбранного протокола");
    return;
  }
  setStatus("Загружаю форму...");
  const data = await api("/protocols/" + id);
  if (data.status === "error") {
    setStatus("Протокол не найден");
    return;
  }
  state.currentProtocol = data;
  buildVisitForm(data);
  setStatus("Форма готова");
}

function buildVisitForm(protocol) {
  const form = document.getElementById("visit-form");
  const title = document.getElementById("visit-title");
  form.innerHTML = "";
  title.textContent = "Форма визита: " + (protocol.name || "");

  const sections = protocol.sections || [];
  for (const sec of sections) {
    const h = document.createElement("h3");
    h.textContent = sec.title || "Раздел";
    form.appendChild(h);

    const fields = sec.fields || [];
    for (const f of fields) {
      const wrap = document.createElement("div");
      wrap.className = "field";

      const label = document.createElement("label");
      label.textContent = f.label + (f.required ? " *" : "");
      wrap.appendChild(label);

      let input = null;
      if (f.field_type === "boolean") {
        input = document.createElement("input");
        input.type = "checkbox";
      } else if (f.field_type === "number") {
        input = document.createElement("input");
        input.type = "number";
        input.step = "any";
      } else if (f.field_type === "date") {
        input = document.createElement("input");
        input.type = "date";
      } else {
        input = document.createElement("input");
        input.type = "text";
      }

      input.name = f.key;
      input.dataset.type = f.field_type;
      wrap.appendChild(input);
      form.appendChild(wrap);
    }
  }
}

function readVisitForm() {
  const result = {};
  const form = document.getElementById("visit-form");
  const inputs = form.querySelectorAll("input");
  for (const input of inputs) {
    const key = input.name;
    const type = input.dataset.type;
    if (!key) {
      continue;
    }

    if (type === "boolean") {
      result[key] = input.checked;
    } else if (type === "number") {
      if (input.value === "") {
        result[key] = null;
      } else {
        result[key] = Number(input.value);
      }
    } else {
      if (input.value === "") {
        result[key] = null;
      } else {
        result[key] = input.value;
      }
    }
  }
  return result;
}

function renderIssues(items) {
  const root = document.getElementById("issues");
  root.innerHTML = "";
  if (!items || items.length === 0) {
    const ok = document.createElement("div");
    ok.className = "ok";
    ok.textContent = "Замечаний нет";
    root.appendChild(ok);
    return;
  }

  for (const item of items) {
    const box = document.createElement("div");
    box.className = "issue";
    if (item.severity === "error") {
      box.classList.add("error");
    }
    const msg = item.message || "Проблема";
    const field = item.field_id || "-";
    box.innerHTML = "<b>" + msg + "</b><br>field_id: " + field;
    root.appendChild(box);
  }
}

async function checkVisit() {
  if (!state.currentProtocol) {
    setStatus("Сначала выбери протокол");
    return;
  }

  const data = readVisitForm();
  setStatus("Проверяю...");
  const result = await api("/protocols/" + state.currentProtocol.id + "/validate", {
    method: "POST",
    body: JSON.stringify(data)
  });

  if (result.status === "error") {
    setStatus("Ошибка проверки");
    return;
  }

  renderIssues(result.issues || []);
  setStatus("Проверка завершена");
}

document.getElementById("go-home").onclick = function () {
  show("home");
};
document.getElementById("go-list").onclick = function () {
  show("list");
  loadProtocols();
};
document.getElementById("go-accept").onclick = function () {
  show("accept");
  loadProtocols();
};
document.getElementById("add-section").onclick = function () {
  createSection();
};
document.getElementById("save-protocol").onclick = function () {
  saveProtocol();
};
document.getElementById("refresh-list").onclick = function () {
  loadProtocols();
};
document.getElementById("load-protocol").onclick = function () {
  loadSelectedProtocol();
};
document.getElementById("check-visit").onclick = function (e) {
  e.preventDefault();
  checkVisit();
};

createSection();
loadProtocols();
