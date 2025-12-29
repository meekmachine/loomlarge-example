import bpy
import sys
import os

# Get the input and output file paths from command line arguments
input_file = sys.argv[sys.argv.index("--") + 1]
output_file = sys.argv[sys.argv.index("--") + 2]

print(f"Compressing {input_file} -> {output_file}")

# Clear the default scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# Import the GLB file
print("Importing GLB...")
bpy.ops.import_scene.gltf(filepath=input_file)

# Skip texture resizing - it can cause issues with embedded textures
# Just rely on Draco compression for mesh data
print("Skipping texture optimization (using original textures)")

# 2. Skip mesh decimation to preserve morph targets (shape keys)
# Decimation cannot be applied to meshes with shape keys without destroying facial animation
print("Skipping mesh decimation (preserving morph targets for facial animation)")

# Export as GLB with compression
print("Exporting compressed GLB...")
bpy.ops.export_scene.gltf(
    filepath=output_file,
    export_format='GLB',
    export_draco_mesh_compression_enable=True,  # Enable Draco compression
    export_draco_mesh_compression_level=6,      # Moderate compression level (balance speed/size)
    export_draco_position_quantization=14,      # Position quantization bits
    export_draco_normal_quantization=10,        # Normal quantization bits
    export_draco_texcoord_quantization=12,      # Texture coordinate quantization bits
    export_texture_dir='',
    export_image_format='AUTO',                 # Keep original texture format (more reliable)
    export_animations=True,                     # Keep animations
    export_morph=True,                          # Keep morph targets (important for facial expressions)
    export_skins=True,                          # Keep skinning data
)

print("Compression complete!")

# Print file sizes
input_size = os.path.getsize(input_file) / (1024 * 1024)
output_size = os.path.getsize(output_file) / (1024 * 1024)
print(f"Input size: {input_size:.2f} MB")
print(f"Output size: {output_size:.2f} MB")
print(f"Compression ratio: {(1 - output_size/input_size) * 100:.1f}%")
