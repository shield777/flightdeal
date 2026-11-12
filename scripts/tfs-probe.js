// 구글 항공권 tfs 주소 (protobuf → base64url)
const varint = n => { const b = []; while (n > 127) { b.push((n & 127) | 128); n >>>= 7; } b.push(n); return b; };
const tag = (f, w) => varint((f << 3) | w);
const vi = (f, n) => [...tag(f, 0), ...varint(n)];
const ld = (f, bytes) => [...tag(f, 2), ...varint(bytes.length), ...bytes];
const str = (f, s) => ld(f, [...Buffer.from(s, 'utf8')]);
function tfs({ from, to, dep, ret, adults = 1, children = 0, infants = 0, direct = false }) {
  const leg = (d, a, b) => ld(3, [...str(2, d), ...(direct ? vi(5, 0) : []), ...ld(13, str(2, a)), ...ld(14, str(2, b))]);
  const pax = [...Array(adults).fill(1), ...Array(children).fill(2), ...Array(infants).fill(4)];
  const bytes = [...leg(dep, from, to), ...(ret ? leg(ret, to, from) : []), ...pax.flatMap(p => vi(8, p)), ...vi(9, 1), ...vi(19, ret ? 1 : 2)];
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
module.exports = { tfs };
if (require.main === module) console.log(tfs({ from: 'SEL', to: 'KIX', dep: '2026-12-10', ret: '2026-12-14', adults: 2 }));
