"""Afterspin original 3D sculpture. Run with Blender in background."""
import bpy, math, os
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
def mesh_ribbon():
    vs=[]; faces=[]; n=1050; k=16
    for i in range(n):
        t=i/(n-1); a=0.38+t*math.tau*2.12; r=2.55*(1-t)**.76+.13
        x=r*math.cos(a); y=r*math.sin(a)*.87
        z=.83*math.sin(a*.71+.8)*(1-t*.48)+.36*math.sin(a*1.35)*t
        turn=a+.2+1.30*math.sin(a*.56-1.5)
        width=(.18+.48*math.sin(math.pi*(t+.07))**2 + .24*(1-t))*(min(1,t*13+.12))*max(.12,min(1,(1-t)*12))
        for j in range(k):
            q=math.tau*j/k; u=math.cos(q); v=math.sin(q)
            vs.append((x+width*u*math.cos(turn)+.085*v*math.sin(turn),y+width*u*math.sin(turn)-.085*v*math.cos(turn),z+.26*u*math.sin(a*.6+.9)+.12*v))
    for i in range(n-1):
        for j in range(k):
            m=i*k; l=(j+1)%k
            faces.append((m+j,m+l,m+l+k,m+j+k))
    faces.extend([tuple(reversed(range(k))), tuple(range((n-1)*k,n*k))])
    mesh=bpy.data.meshes.new('Ribbon'); mesh.from_pydata(vs,[],faces); mesh.update()
    obj=bpy.data.objects.new('Afterspin ribbon',mesh); bpy.context.collection.objects.link(obj)
    for p in mesh.polygons: p.use_smooth=True
    return obj
ob=mesh_ribbon()
mat=bpy.data.materials.new('Iridescent violet'); mat.use_nodes=True
nt=mat.node_tree; p=nt.nodes.get('Principled BSDF'); p.inputs['Metallic'].default_value=.63; p.inputs['Roughness'].default_value=.23; p.inputs['Coat Weight'].default_value=.45
geo=nt.nodes.new('ShaderNodeLayerWeight'); geo.inputs['Blend'].default_value=.58
ramp=nt.nodes.new('ShaderNodeValToRGB'); cr=ramp.color_ramp; cr.elements.remove(cr.elements[1])
for i,(pos,col) in enumerate([(0,(.69,.46,1,1)),(.20,(.30,.12,.81,1)),(.44,(.16,.018,.50,1)),(.68,(.28,.048,.70,1)),(1,(.07,.008,.25,1))]):
    el=cr.elements[0] if i==0 else cr.elements.new(pos); el.position=pos; el.color=col
nt.links.new(geo.outputs['Facing'],ramp.inputs[0]); nt.links.new(ramp.outputs[0],p.inputs['Base Color']); ob.data.materials.append(mat)
def aim(o,at=(0,0,0)): o.rotation_euler=(Vector(at)-o.location).to_track_quat('-Z','Y').to_euler()
def light(name,loc,pow,col,size):
    d=bpy.data.lights.new(name,'AREA'); d.energy=pow; d.color=col; d.shape='DISK'; d.size=size
    o=bpy.data.objects.new(name,d); bpy.context.collection.objects.link(o); o.location=loc; aim(o)
light('Soft pearl',(-3,4,6),900,(.84,.76,1),5)
light('Magenta rim',(4,2,3),960,(.77,.35,1),3)
light('Blue strip',(-4,-3,2),760,(.31,.34,1),4)
light('Face lift',(2,-3,6),550,(.75,.68,1),5)
scene=bpy.context.scene; scene.world=bpy.data.worlds.new('Studio'); scene.world.use_nodes=True
scene.world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.37,.22,.68,1)
scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.46
camd=bpy.data.cameras.new('Camera'); cam=bpy.data.objects.new('Camera',camd); bpy.context.collection.objects.link(cam); cam.location=(.2,-3.0,10); aim(cam,(.03,0,0)); camd.type='ORTHO'; camd.ortho_scale=6.15; scene.camera=cam
scene.render.engine='CYCLES'; scene.cycles.samples=48; scene.cycles.use_denoising=False; scene.render.resolution_x=960; scene.render.resolution_y=840; scene.render.resolution_percentage=100; scene.render.film_transparent=True
scene.view_settings.view_transform='AgX'; scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'; scene.render.filepath=os.path.join(os.path.dirname(os.path.abspath(__file__)),'ribbon.png')
bpy.ops.render.render(write_still=True)
