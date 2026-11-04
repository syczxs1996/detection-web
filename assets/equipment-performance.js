/* Merge static, opaque equipment parts while preserving their world-space shape. */
window.optimizeEquipment=function(T,root){
  root.updateMatrixWorld(true);
  const inverse=new T.Matrix4().copy(root.matrixWorld).invert(),buckets=new Map(),removed=[];
  root.traverse(mesh=>{
    if(!mesh.isMesh||mesh.isInstancedMesh||Array.isArray(mesh.material)||mesh.material.transparent||mesh.geometry.morphAttributes.position)return;
    const matrix=new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);
    const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geometry.applyMatrix4(matrix);geometry.computeBoundingBox();
    const size=geometry.boundingBox.getSize(new T.Vector3()).toArray().sort((a,b)=>b-a);
    const cast=mesh.castShadow&&size[0]>=300&&size[1]>=80;
    const key=mesh.material.uuid+':'+cast+':'+mesh.receiveShadow;
    if(!buckets.has(key))buckets.set(key,{material:mesh.material,cast,receive:mesh.receiveShadow,parts:[]});
    buckets.get(key).parts.push(geometry);removed.push(mesh);
  });
  const originals=new Set();for(const mesh of removed){originals.add(mesh.geometry);mesh.parent.remove(mesh);}originals.forEach(g=>g.dispose());
  for(const b of buckets.values()){
    const merged=new T.BufferGeometry();
    for(const name of ['position','normal','uv']){
      if(!b.parts.every(p=>p.getAttribute(name)))continue;
      const length=b.parts.reduce((n,p)=>n+p.getAttribute(name).array.length,0),array=new Float32Array(length);let offset=0;
      for(const p of b.parts){const a=p.getAttribute(name).array;array.set(a,offset);offset+=a.length;}
      merged.setAttribute(name,new T.BufferAttribute(array,b.parts[0].getAttribute(name).itemSize));
    }
    merged.computeBoundingBox();merged.computeBoundingSphere();b.parts.forEach(p=>p.dispose());
    const mesh=new T.Mesh(merged,b.material);mesh.castShadow=b.cast;mesh.receiveShadow=b.receive;root.add(mesh);
  }
  return root;
};
