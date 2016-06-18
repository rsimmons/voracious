const gen32 = () => Math.random().toString(16).substring(2, 10);

export default () => gen32() + gen32();
