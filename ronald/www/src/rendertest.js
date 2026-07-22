import * as THREE from 
"https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";


const scene = new THREE.Scene();

scene.background = new THREE.Color(0x2b2d30);


const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    100
);

camera.position.set(0,0,8);
camera.lookAt(0,0,0);


const renderer = new THREE.WebGLRenderer({
    antialias:true
});


renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

document.body.appendChild(renderer.domElement);



const geometry = new THREE.TetrahedronGeometry(2);

const material = new THREE.MeshBasicMaterial({
    color:0xffffff,
    wireframe:true
});


const tetra = new THREE.Mesh(
    geometry,
    material
);


scene.add(tetra);



function animate(){

    requestAnimationFrame(animate);

    tetra.rotation.x += 0.01;
    tetra.rotation.y += 0.01;

    renderer.render(
        scene,
        camera
    );
}


animate();