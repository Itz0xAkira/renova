/**
 * Cheap setters for game objects touched every frame. Phaser re-sorts the whole
 * display list whenever any depth is assigned (even to the same value), and
 * setTexture re-resolves the frame, so only call them when something changed.
 */
import type Phaser from 'phaser'

type Img = Phaser.GameObjects.Image

export function setTex(img: Img, key: string) {
  if (img.texture.key !== key) img.setTexture(key)
  return img
}

export function setDep(obj: { depth: number; setDepth(d: number): unknown }, depth: number) {
  if (obj.depth !== depth) obj.setDepth(depth)
}
