# Run by Blender in background mode: blender -b --python blender-export-tree.py -- input.gltf output.glb
# No third-party Python packages required; uses Blender's built-in glTF importer/exporter.
import bpy
import os
import sys

def main():
    if "--" not in sys.argv:
        raise RuntimeError("Expected source glTF and output GLB after --")
    args = sys.argv[sys.argv.index("--") + 1:]
    if len(args) != 2:
        raise RuntimeError("Usage: -- <source.gltf> <output.glb>")
    source, output = map(os.path.abspath, args)
    if not os.path.isfile(source) or not source.lower().endswith(".gltf"):
        raise RuntimeError("Source must be an existing .gltf model")
    if not output.lower().endswith(".glb"):
        raise RuntimeError("Output must be a .glb file")

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=source)

    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("Downloaded model contains no mesh geometry")

    triangles = 0
    for obj in meshes:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
    print("SL Ravan: source contains %s meshes / %s triangles" % (len(meshes), triangles))
    if triangles > 600000:
        raise RuntimeError("Source has over 600,000 triangles. Select a lower LOD in Blender before exporting.")
    if triangles < 200:
        raise RuntimeError("Source tree has unexpectedly little geometry; check downloaded files")

    material_count = sum(bool(obj.data.materials) for obj in meshes)
    if not material_count:
        raise RuntimeError("Model has no assigned materials; this is not acceptable hero art")

    for obj in tuple(bpy.context.scene.objects):
        if obj.type in {"CAMERA", "LIGHT"}:
            bpy.data.objects.remove(obj, do_unlink=True)

    os.makedirs(os.path.dirname(output), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=output,
        export_format="GLB",
        export_apply=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False
    )
    if not os.path.isfile(output) or os.path.getsize(output) < 1000:
        raise RuntimeError("Blender did not produce a valid-sized GLB")
    print("SL Ravan: GLB exported to", output)

if __name__ == "__main__":
    main()
