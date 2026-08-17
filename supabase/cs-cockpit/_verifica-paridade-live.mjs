// Prova que o corpo de um .sql de função aqui versionado é BYTE-IDÊNTICO ao que roda no banco.
//   node supabase/cs-cockpit/_verifica-paridade-live.mjs <arquivo.sql> <md5_do_banco> <tam_do_banco>
// O md5/tam do banco vêm de:
//   select md5(prosrc), length(prosrc) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
//    where n.nspname='public' and p.proname='<nome>' and p.prokind='f';
//
// Por que existe: em 17/08 a igualdade de md5 foi o que provou que ninguém havia editado a função
// direto no banco — só com ela é seguro dar CREATE OR REPLACE por cima.
//
// ⚠️ O corpo é localizado DEPOIS de remover os comentários: o marcador delimitador aparece citado
// no cabeçalho de arquivo, e um indexOf ingênuo para na MENÇÃO (deu "corpo" 1.286 bytes maior).
import fs from 'node:fs';
import crypto from 'node:crypto';

const [arquivo, md5Banco, tamBanco] = process.argv.slice(2);
if (!arquivo) { console.error('uso: node _verifica-paridade-live.mjs <arquivo.sql> [md5_banco] [tam_banco]'); process.exit(2); }

const MARCA = '$' + 'func' + '$'; // montado para o próprio arquivo não conter o literal
const bruto = fs.readFileSync(arquivo, 'utf8').replace(/\r\n/g, '\n');
const semComentario = bruto.replace(/^\s*--[^\n]*$/gm, '');

const ini = semComentario.indexOf(MARCA);
const fim = semComentario.lastIndexOf(MARCA);
if (ini < 0 || fim <= ini) { console.error('FALHOU: delimitador do corpo não encontrado'); process.exit(1); }

// recorta no texto ORIGINAL, ancorando pelo trecho achado no texto sem comentário
const ancora = semComentario.slice(ini, ini + MARCA.length + 40);
const iniReal = bruto.indexOf(ancora);
const fimReal = bruto.lastIndexOf(MARCA);
const corpo = bruto.slice(iniReal + MARCA.length, fimReal);

if (corpo.length < 5000) { console.error(`FALHOU: corpo com ${corpo.length} bytes — piso é 5000, o recorte pegou a coisa errada`); process.exit(1); }
for (const a of ['flags_long', 'flags_agg', 'is_cs_or_admin', 'from metrics m']) {
  if (!corpo.includes(a)) { console.error(`FALHOU: âncora ausente no corpo recortado: ${a}`); process.exit(1); }
}

const md5 = crypto.createHash('md5').update(corpo).digest('hex');
console.log(`arquivo: md5=${md5} tam=${corpo.length}`);
if (!md5Banco) { console.log('(sem md5 do banco no argv — só extraí o corpo)'); process.exit(0); }
console.log(`banco  : md5=${md5Banco} tam=${tamBanco}`);
const ok = md5 === md5Banco && (!tamBanco || corpo.length === Number(tamBanco));
console.log(ok ? 'PARIDADE OK — arquivo versionado == função no banco' : 'DIVERGENTE — NÃO dê replace antes de entender a diferença');
process.exit(ok ? 0 : 1);
