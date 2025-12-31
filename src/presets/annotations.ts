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
  markerStyle: 'html', // Simple numbered dots directly over targets
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
      bones: ['CC_Base_L_Eye'], // Use bone for accurate marker positioning
      paddingFactor: 1.2,
    },
    {
      name: 'right_eye',
      bones: ['CC_Base_R_Eye'], // Use bone for accurate marker positioning
      paddingFactor: 1.2,
    },
    {
      name: 'mouth',
      bones: ['CC_Base_JawRoot'], // Use bone only - teeth/tongue meshes are skinned and report origin
      paddingFactor: 1.5,
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
      cameraAngle: 180,
    },
    {
      name: 'left_hand',
      bones: ['CC_Base_L_Hand'],
      paddingFactor: 1.3,
      cameraAngle: 270, // View from left side
    },
    {
      name: 'right_hand',
      bones: ['CC_Base_R_Hand'],
      paddingFactor: 1.3,
      cameraAngle: 90, // View from right side
    },
    {
      name: 'left_foot',
      bones: ['CC_Base_L_Foot', 'CC_Base_L_ToeBase'],
      paddingFactor: 2.5,
      cameraAngle: 270, // View from left side
    },
    {
      name: 'right_foot',
      bones: ['CC_Base_R_Foot', 'CC_Base_R_ToeBase'],
      paddingFactor: 2.5,
      cameraAngle: 90, // View from right side
    },
  ],
};

/**
 * Betta Fish annotations
 * Bone names from the betta fish Sketchfab model (53 bones, skeletal animation)
 *
 * Bone hierarchy:
 * - Bone001 = HEAD
 * - Bone002/003/004 = BODY (front/mid/back)
 * - Bone005 = TAIL_BASE
 * - Bone006/007/008 = DORSAL FIN (top fin)
 * - Bone009 = PECTORAL_L_ROOT (left pectoral fin)
 * - Bone010 = PECTORAL_R_ROOT (right pectoral fin)
 * - Bone018/019 = VENTRAL fins (bottom fins)
 * - Bone020+ = TAIL fins
 * - Bone046/048/050 = GILL_L (left operculum/branchiostegal)
 * - Bone047/049/051 = GILL_R (right operculum/branchiostegal)
 */
export const BETTA_FISH_ANNOTATIONS: CharacterAnnotationConfig = {
  characterId: 'betta',
  characterName: 'Betta Fish',
  modelPath: 'characters/betta/scene.gltf',
  defaultAnnotation: 'full_body',
  markerStyle: '3d', // 3D markers with lines and labels
  annotations: [
    {
      name: 'full_body',
      objects: ['*'],
      paddingFactor: 2.5,
    },
    {
      name: 'head',
      bones: ['Bone001_Armature'],
      paddingFactor: 1.8,
    },
    {
      name: 'left_eye',
      meshes: ['EYES_0'], // Eye mesh - marker will be placed on left side
      paddingFactor: 1.4,
      cameraAngle: 270, // View from left side to see left eye
    },
    {
      name: 'right_eye',
      meshes: ['EYES_0'], // Eye mesh - marker will be placed on right side
      paddingFactor: 1.4,
      cameraAngle: 90, // View from right side to see right eye
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
        'Bone020_Armature',
        'Bone039_Armature',
      ],
      paddingFactor: 1.6,
    },
    {
      name: 'dorsal_fin',
      bones: ['Bone006_Armature', 'Bone007_Armature', 'Bone008_Armature'],
      paddingFactor: 1.8,
    },
    {
      name: 'pectoral_fin_left',
      bones: [
        'Bone009_Armature',
        'Bone027_Armature',
        'Bone028_Armature',
      ],
      paddingFactor: 1.6,
    },
    {
      name: 'pectoral_fin_right',
      bones: [
        'Bone010_Armature',
        'Bone012_Armature',
        'Bone011_Armature',
      ],
      paddingFactor: 1.6,
    },
    {
      name: 'ventral_fins',
      bones: [
        'Bone018_Armature',
        'Bone033_Armature',
      ],
      paddingFactor: 1.6,
    },
    {
      name: 'gill_left',
      bones: ['Bone046_Armature', 'Bone048_Armature', 'Bone050_Armature'],
      paddingFactor: 1.4,
      cameraAngle: 270, // View from left side to see left gill
    },
    {
      name: 'gill_right',
      bones: ['Bone047_Armature', 'Bone049_Armature', 'Bone051_Armature'],
      paddingFactor: 1.4,
      cameraAngle: 90, // View from right side to see right gill
    },
    {
      name: 'gills',
      // Both gills - camera will show front view
      bones: [
        'Bone046_Armature',
        'Bone047_Armature',
        'Bone048_Armature',
        'Bone049_Armature',
      ],
      paddingFactor: 1.6,
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
