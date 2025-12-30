import type { CharacterAnnotationConfig, AnnotationRegistry } from '../camera/types';

/**
 * Jonathan character annotations
 * CC4 bone names for Character Creator 4 exported characters
 */
export const JONATHAN_ANNOTATIONS: CharacterAnnotationConfig = {
  characterId: 'jonathan',
  characterName: 'Jonathan',
  modelPath: 'characters/jonathan_new.glb',
  defaultAnnotation: 'full_body',
  annotations: [
    {
      name: 'full_body',
      objects: ['*'],
      paddingFactor: 2.0,
    },
    {
      name: 'head',
      bones: ['CC_Base_Head', 'CC_Base_JawRoot'],
      paddingFactor: 1.5,
    },
    {
      name: 'face',
      bones: ['CC_Base_Head', 'CC_Base_L_Eye', 'CC_Base_R_Eye', 'CC_Base_JawRoot'],
      paddingFactor: 1.3,
    },
    {
      name: 'left_eye',
      bones: ['CC_Base_L_Eye'],
      paddingFactor: 3.0,
    },
    {
      name: 'right_eye',
      bones: ['CC_Base_R_Eye'],
      paddingFactor: 3.0,
    },
    {
      name: 'mouth',
      bones: ['CC_Base_JawRoot', 'CC_Base_Tongue01'],
      paddingFactor: 2.0,
    },
    {
      name: 'upper_body',
      bones: [
        'CC_Base_Spine02',
        'CC_Base_Head',
        'CC_Base_L_Clavicle',
        'CC_Base_R_Clavicle',
      ],
      paddingFactor: 1.6,
    },
    {
      name: 'back',
      bones: ['CC_Base_Spine01', 'CC_Base_Spine02'],
      paddingFactor: 1.8,
    },
    {
      name: 'left_hand',
      bones: ['CC_Base_L_Hand'],
      paddingFactor: 2.5,
    },
    {
      name: 'right_hand',
      bones: ['CC_Base_R_Hand'],
      paddingFactor: 2.5,
    },
    {
      name: 'left_foot',
      bones: ['CC_Base_L_Foot', 'CC_Base_L_ToeBase'],
      paddingFactor: 2.5,
    },
    {
      name: 'right_foot',
      bones: ['CC_Base_R_Foot', 'CC_Base_R_ToeBase'],
      paddingFactor: 2.5,
    },
  ],
};

/**
 * Betta Fish annotations
 * Bone names from the betta fish Sketchfab model (53 bones, skeletal animation)
 */
export const BETTA_FISH_ANNOTATIONS: CharacterAnnotationConfig = {
  characterId: 'betta',
  characterName: 'Betta Fish',
  modelPath: 'characters/betta/scene.gltf',
  defaultAnnotation: 'full_body',
  annotations: [
    {
      name: 'full_body',
      objects: ['*'],
      paddingFactor: 2.5,
    },
    {
      name: 'head',
      bones: ['Bone001_Armature', 'Bone009_Armature', 'Bone010_Armature'],
      paddingFactor: 1.5,
    },
    {
      name: 'body',
      bones: ['Bone002_Armature', 'Bone003_Armature', 'Bone004_Armature'],
      paddingFactor: 1.8,
    },
    {
      name: 'tail',
      bones: [
        'Bone005_Armature',
        'Bone018_Armature',
        'Bone019_Armature',
        'Bone020_Armature',
      ],
      paddingFactor: 1.6,
    },
    {
      name: 'dorsal_fin',
      bones: ['Bone006_Armature', 'Bone007_Armature', 'Bone008_Armature'],
      paddingFactor: 1.8,
    },
    {
      name: 'pectoral_fins',
      bones: [
        'Bone009_Armature',
        'Bone027_Armature',
        'Bone010_Armature',
        'Bone012_Armature',
      ],
      paddingFactor: 1.6,
    },
    {
      name: 'gills',
      bones: [
        'Bone046_Armature',
        'Bone047_Armature',
        'Bone048_Armature',
        'Bone049_Armature',
      ],
      paddingFactor: 1.4,
    },
  ],
};

/**
 * Default character config (for testing or fallback)
 */
export const DEFAULT_ANNOTATIONS: CharacterAnnotationConfig = {
  characterId: 'default',
  characterName: 'Default Character',
  modelPath: 'characters/default.glb',
  defaultAnnotation: 'full_body',
  annotations: [
    {
      name: 'full_body',
      objects: ['*'],
      paddingFactor: 2.0,
    },
  ],
};

/**
 * Registry of all available characters
 */
export const ANNOTATION_REGISTRY: AnnotationRegistry = {
  characters: [JONATHAN_ANNOTATIONS, BETTA_FISH_ANNOTATIONS, DEFAULT_ANNOTATIONS],
  defaultCharacter: 'jonathan',
};

/**
 * Get annotation config by character ID
 */
export function getAnnotationConfig(characterId: string): CharacterAnnotationConfig | undefined {
  return ANNOTATION_REGISTRY.characters.find((c) => c.characterId === characterId);
}

/**
 * Get all character IDs
 */
export function getCharacterIds(): string[] {
  return ANNOTATION_REGISTRY.characters.map((c) => c.characterId);
}

/**
 * Get all character configs
 */
export function getAllCharacterConfigs(): CharacterAnnotationConfig[] {
  return ANNOTATION_REGISTRY.characters;
}

/**
 * Get the default character config
 */
export function getDefaultCharacterConfig(): CharacterAnnotationConfig | undefined {
  if (!ANNOTATION_REGISTRY.defaultCharacter) {
    return ANNOTATION_REGISTRY.characters[0];
  }
  return getAnnotationConfig(ANNOTATION_REGISTRY.defaultCharacter);
}
