// Testes puros (node:assert, sem framework) — trava o formato do unit_address.
// Rodar: node src/lib/addressUtils.test.mjs
import assert from "node:assert";
import { assembleUnitAddress, foldStreetNumber, stripCityUf, resolveDeliveryAddress } from "./addressUtils.js";

// ── Caso fiscal-only: número separado, rua sem número -> anexa (bug Campo Limpo) ──
assert.equal(
  assembleUnitAddress({
    street: "Rua Hugo Sardella",
    number: "47",
    neighborhood: "Jardim Vera Regina",
    city: "Campo Limpo Paulista - SP",
    cep: "13236320",
  }),
  "Rua Hugo Sardella 47, Jardim Vera Regina, Campo Limpo Paulista - 13236320"
);

// ── Caso wizard: número já embutido na rua -> NÃO duplica ──
assert.equal(
  assembleUnitAddress({
    street: "Rua Wilson Muner 47",
    number: "47",
    neighborhood: "Jardim do Lago",
    city: "Bragança Paulista",
    cep: "12914550",
  }),
  "Rua Wilson Muner 47, Jardim do Lago, Bragança Paulista - 12914550"
);

// ── Wizard com vírgula antes do número (não duplica) ──
assert.equal(
  assembleUnitAddress({
    street: "Avenida Conselheiro Carrão, 3474",
    number: "3474",
    neighborhood: "Vila Carrão",
    city: "São Paulo",
    cep: "03402003",
  }),
  "Avenida Conselheiro Carrão, 3474, Vila Carrão, São Paulo - 03402003"
);

// ── Sem número: usa a rua como veio ──
assert.equal(
  assembleUnitAddress({
    street: "Rua Sem Numero",
    neighborhood: "Centro",
    city: "Itu - SP",
    cep: "13300000",
  }),
  "Rua Sem Numero, Centro, Itu - 13300000"
);

// ── Partes faltando não deixam vírgula/traço solto ──
assert.equal(assembleUnitAddress({ street: "Rua Só Rua", cep: "01000000" }), "Rua Só Rua - 01000000");
assert.equal(assembleUnitAddress({ street: "Rua X" }), "Rua X");
assert.equal(assembleUnitAddress({}), "");

// ── foldStreetNumber ──
assert.equal(foldStreetNumber("Rua A", "10"), "Rua A 10");
assert.equal(foldStreetNumber("Rua A 10", "10"), "Rua A 10");
assert.equal(foldStreetNumber("Rua A, 10", "10"), "Rua A, 10");
assert.equal(foldStreetNumber("Rua A", ""), "Rua A");
assert.equal(foldStreetNumber("", "10"), "10");

// ── stripCityUf ──
assert.equal(stripCityUf("São Paulo - SP"), "São Paulo");
assert.equal(stripCityUf("São Paulo"), "São Paulo");
assert.equal(stripCityUf("Rio de Janeiro - RJ"), "Rio de Janeiro");
assert.equal(stripCityUf("Itu - SP"), "Itu");

// ── Complemento entra depois do número (o motorista precisa da loja/sala) ──
assert.equal(
  assembleUnitAddress({
    street: "Rua José Michelotti",
    number: "88",
    complement: "Loja 16",
    neighborhood: "Cidade da Saúde",
    city: "Itapevi - SP",
    cep: "06693005",
  }),
  "Rua José Michelotti 88, Loja 16, Cidade da Saúde, Itapevi - 06693005"
);

// ══ resolveDeliveryAddress: endereço da ficha do motorista ══
// Regressão real (23/08/2026): Leme e Itapevi imprimiram a ficha com o endereço
// truncado ("Rua X - CEP") porque o cadastro de franquia NOVA gravava o
// unit_address só com rua+CEP. Os componentes SEMPRE estiveram no banco.

// Itapevi: bairro/cidade só existem em franchises; complemento é "Loja 16".
assert.equal(
  resolveDeliveryAddress(
    { address_number: "88", address_complement: "Loja 16", neighborhood: "Cidade da Saúde", city: "Itapevi - SP" },
    { street_address: "Rua José Michelotti", cep: "06693005", neighborhood: null, city: null,
      unit_address: "Rua José Michelotti - 06693005" }
  ),
  "Rua José Michelotti 88, Loja 16, Cidade da Saúde, Itapevi - 06693005"
);

// Leme: sem complemento.
assert.equal(
  resolveDeliveryAddress(
    { address_number: "693", address_complement: null, neighborhood: "Cidade Jardim", city: "Leme - SP" },
    { street_address: "Rua Neida Zencker Leme", cep: "13614240", neighborhood: null, city: null,
      unit_address: "Rua Neida Zencker Leme - 13614240" }
  ),
  "Rua Neida Zencker Leme 693, Cidade Jardim, Leme - 13614240"
);

// A config manda quando ela tem bairro/cidade próprios (wizard "Meu Vendedor").
assert.equal(
  resolveDeliveryAddress(
    { address_number: "10", neighborhood: "Bairro Fiscal", city: "Cidade Fiscal - SP" },
    { street_address: "Rua A", cep: "01000000", neighborhood: "Bairro Config", city: "Cidade Config" }
  ),
  "Rua A 10, Bairro Config, Cidade Config - 01000000"
);

// Sem rua no cadastro não dá pra compor: cai no que estiver gravado.
assert.equal(
  resolveDeliveryAddress(
    { address_number: "10", neighborhood: "Centro", city: "Itu - SP" },
    { street_address: "", cep: "13300000", unit_address: "Endereço legado gravado à mão" }
  ),
  "Endereço legado gravado à mão"
);

// Rua que já termina em número e DIVERGE do cadastro fiscal: não anexa o segundo
// número (caso real Mogi das Cruzes — "Gen. Longo, 43" com address_number 53).
assert.equal(
  resolveDeliveryAddress(
    { address_number: "53", neighborhood: "Jardim Aeroporto III", city: "Mogi das Cruzes - SP" },
    { street_address: "Gen. Longo, 43", cep: "08717190" }
  ),
  "Gen. Longo, 43, Jardim Aeroporto III, Mogi das Cruzes - 08717190"
);

// Rua com número + sufixo textual (caso real Guarujá): idem, não duplica.
assert.equal(
  resolveDeliveryAddress(
    { address_number: "94", neighborhood: "Vila Zilda ", city: "Guarujá - SP" },
    { street_address: "Rua Nove, 94 casa 1", cep: "11440000" }
  ),
  "Rua Nove, 94 casa 1, Vila Zilda, Guarujá - 11440000"
);

// Número placeholder na rua (caso real Cajamar "Rua Flores do Guarujá 0" com nº 79):
// o zero sai e o número do cadastro fiscal entra — senão o motorista recebe "0".
assert.equal(
  resolveDeliveryAddress(
    { address_number: "79", address_complement: "Casa", neighborhood: "Portal dos Ypes III", city: "Cajamar" },
    { street_address: "Rua Flores do Guarujá 0", cep: "07791235" }
  ),
  "Rua Flores do Guarujá 79, Casa, Portal dos Ypes III, Cajamar - 07791235"
);

// Placeholder com vários zeros (caso real Jardim Duprat "Rua Juana Samary 00000").
assert.equal(
  resolveDeliveryAddress(
    { address_number: "280", address_complement: "Casa 2", neighborhood: "Jardim Duprat", city: "São Paulo" },
    { street_address: "Rua Juana Samary 00000", cep: "05853320" }
  ),
  "Rua Juana Samary 280, Casa 2, Jardim Duprat, São Paulo - 05853320"
);

// Rua cujo NOME termina em número não é placeholder ("Rua 10, 86" - Hortolândia).
assert.equal(
  resolveDeliveryAddress(
    { address_number: "86", neighborhood: "Jardim Residencial Veccon Buriti ", city: "Hortolândia " },
    { street_address: "Rua 10, 86", cep: "13185730" }
  ),
  "Rua 10, 86, Jardim Residencial Veccon Buriti, Hortolândia - 13185730"
);

// Complemento já digitado dentro da rua não repete (caso real Cotia).
assert.equal(
  resolveDeliveryAddress(
    { address_number: "421", address_complement: "Casa 52", neighborhood: "Jardim Colibri", city: "Cotia - SP" },
    { street_address: "Via das Magnólias 421 - Casa 52", cep: "06713-270" }
  ),
  "Via das Magnólias 421 - Casa 52, Jardim Colibri, Cotia - 06713-270"
);

// ...mesmo com pontuação/caixa diferentes (caso real Rio Claro, sem CEP cadastrado).
assert.equal(
  resolveDeliveryAddress(
    { address_number: "2364", address_complement: "entre Av Visconde e Av 26.", neighborhood: "Centro", city: "Rio Claro" },
    { street_address: "Rua 3, 2364 - Entre Av Visconde e Av 26", cep: "" }
  ),
  "Rua 3, 2364 - Entre Av Visconde e Av 26, Centro, Rio Claro"
);

// Complemento NOVO (não repetido) entra (caso real Jundiaí "Apto 152").
assert.equal(
  resolveDeliveryAddress(
    { address_number: "1438", address_complement: "Apto 152", neighborhood: "Vila Rio Branco", city: "Jundiaí" },
    { street_address: "Rua Padre Eucario, 44 - Vila Rio Branco 1438", cep: "13215-281" }
  ),
  "Rua Padre Eucario, 44 - Vila Rio Branco 1438, Apto 152, Vila Rio Branco, Jundiaí - 13215-281"
);

// Nada em lugar nenhum -> string vazia (quem imprime avisa; nunca sai em branco calado).
assert.equal(resolveDeliveryAddress(null, null), "");
assert.equal(resolveDeliveryAddress({}, {}), "");

console.log("addressUtils: todos os testes passaram ✓");
