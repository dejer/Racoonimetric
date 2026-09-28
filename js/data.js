// Game content tables.
export const ITEMS = {
  banana: { name: 'Banana Peel', value: 1, trash: true, slippery: true },
  soda: { name: 'Soda Can', value: 1, trash: true },
  hambone: { name: 'Ham Bone', value: 1, trash: true, food: true },
  pizza: { name: 'Pizza Crust', value: 1, trash: true, food: true },
  apple: { name: 'Apple Core', value: 1, trash: true, food: true },
  boot: { name: 'Old Boot', value: 2, trash: true },
  gnome: { name: 'Garden Gnome', value: 4, owner: 'gardener' },
  trowel: { name: 'Trowel', value: 1, owner: 'gardener', tool: 'dig' },
  tomato: { name: 'Prize Tomato', value: 4, owner: 'gardener', food: true },
  sunhat: { name: 'Sun Hat', value: 4, owner: 'gardener' },
  sausage: { name: 'Sausage', value: 2, owner: 'dad', food: true },
  spatula: { name: 'Spatula', value: 2, owner: 'dad' },
  trophy: { name: 'Grill Trophy', value: 6, owner: 'dad' },
  sock: { name: 'Polka Sock', value: 2, owner: 'dad' },
  sock2: { name: 'Stripy Sock', value: 2, owner: 'dad' },
  duck: { name: 'Rubber Duck', value: 3, owner: 'dad' },
  ball: { name: 'Tennis Ball', value: 1 },
  flamingo: { name: 'Lawn Flamingo', value: 4 },
};
export const THRONE_GOAL = 30;

export const OBJECTIVES = [
  { id: 'knock_trash', sec: 'The Alley', text: 'Knock over a trash can', unlock: 'traffic_cone' },
  { id: 'hoard_trash', sec: 'The Alley', text: 'Stash some trash in your den', unlock: 'monocle' },
  { id: 'hide_bush', sec: 'The Alley', text: 'Hide in a bush while being hunted', unlock: 'leaf_cape' },
  { id: 'steal_gnome', sec: 'The Front Garden', text: 'Kidnap the garden gnome', unlock: 'gnome_hat' },
  { id: 'soak_gardener', sec: 'The Front Garden', text: 'Soak the gardener with the sprinkler', unlock: 'goggles' },
  { id: 'steal_sunhat', sec: 'The Front Garden', text: "Pinch the gardener's sun hat", unlock: 'sun_hat' },
  { id: 'slip_banana', sec: 'The Front Garden', text: 'Make someone slip on a banana peel', unlock: 'clown_nose' },
  { id: 'steal_tomato', sec: 'The Front Garden', text: 'Hoard the prize tomato', unlock: 'blue_ribbon' },
  { id: 'dig_tunnel', sec: 'The Front Garden', text: 'Dig a tunnel into the backyard', unlock: 'miner_helmet' },
  { id: 'befriend_dog', sec: 'The Backyard', text: 'Make friends with the dog', unlock: 'dog_collar' },
  { id: 'make_dance', sec: 'The Backyard', text: 'Make the grill dad dance', unlock: 'disco_shades' },
  { id: 'steal_sausage', sec: 'The Backyard', text: 'Snatch a sausage off the grill', unlock: 'chef_hat' },
  { id: 'steal_sock', sec: 'The Backyard', text: 'Swipe a sock from the clothesline', unlock: 'striped_scarf' },
  { id: 'steal_trophy', sec: 'The Backyard', text: 'Hoard the Grill Master trophy', unlock: 'gold_chain' },
  { id: 'trash_throne', sec: 'Grand Finale', text: `Hoard ${THRONE_GOAL}✦ of treasure to build a Trash Throne`, unlock: 'crown' },
  { id: 'crown_self', sec: 'Grand Finale', text: 'Take your seat on the Trash Throne', unlock: 'royal_cape' },
];

export const ACCESSORIES = [
  { id: 'party_hat', slot: 'head', name: 'Party Hat', start: true },
  { id: 'traffic_cone', slot: 'head', name: 'Traffic Cone' },
  { id: 'gnome_hat', slot: 'head', name: 'Gnome Hat' },
  { id: 'sun_hat', slot: 'head', name: 'Sun Hat' },
  { id: 'chef_hat', slot: 'head', name: 'Chef Hat' },
  { id: 'miner_helmet', slot: 'head', name: 'Miner Helmet' },
  { id: 'crown', slot: 'head', name: 'Trash Crown' },
  { id: 'monocle', slot: 'face', name: 'Monocle' },
  { id: 'goggles', slot: 'face', name: 'Swim Goggles' },
  { id: 'clown_nose', slot: 'face', name: 'Clown Nose' },
  { id: 'disco_shades', slot: 'face', name: 'Disco Shades' },
  { id: 'red_bandana', slot: 'neck', name: 'Bandit Bandana', start: true },
  { id: 'blue_ribbon', slot: 'neck', name: 'Blue Ribbon' },
  { id: 'dog_collar', slot: 'neck', name: 'Dog Collar' },
  { id: 'striped_scarf', slot: 'neck', name: 'Stripy Scarf' },
  { id: 'gold_chain', slot: 'neck', name: 'Gold Chain' },
  { id: 'leaf_cape', slot: 'back', name: 'Leaf Cape' },
  { id: 'royal_cape', slot: 'back', name: 'Royal Cape' },
];
export const FUR_LIST = [
  { id: 'classic', name: 'Classic Grey', need: 0 },
  { id: 'ginger', name: 'Ginger', need: 4 },
  { id: 'midnight', name: 'Midnight', need: 8 },
  { id: 'snowy', name: 'Snowy', need: 12 },
  { id: 'golden', name: 'Golden', need: 16 },
];
export const SLOTS = ['head', 'face', 'neck', 'back', 'fur'];
export function unlockHint(accId) {
  const o = OBJECTIVES.find((x) => x.unlock === accId);
  return o ? o.text : 'Available from the start';
}
