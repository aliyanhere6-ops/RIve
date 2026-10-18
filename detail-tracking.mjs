export function colorNumber(hex){
  if(!/^#[0-9a-f]{6}$/i.test(hex))throw Error('Invalid background colour');
  return (0xff000000|parseInt(hex.slice(1),16))>>>0;
}
