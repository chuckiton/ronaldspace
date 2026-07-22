import * as THREE from "three";

import {
    OrbitControls
}
from "three/addons/controls/OrbitControls.js";

// ===============================
// RONALD SPACE DEFINITIONS
// ===============================


const vectors = {

    R: new THREE.Vector3( 1,  1,  1 ),
    N: new THREE.Vector3(-1, -1,  1 ),
    L: new THREE.Vector3(-1,  1, -1 ),
    D: new THREE.Vector3( 1, -1, -1 )

};


// ===============================
// SCENE
// ===============================


const scene = new THREE.Scene();

scene.background =
new THREE.Color(0x2b2d30);



// ===============================
// CAMERA
// ===============================


const camera =
new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    100
);


camera.position.set(
    6,
    6,
    6
);

camera.lookAt(
    0,
    0,
    0
);



// ===============================
// RENDERER
// ===============================


const renderer =
new THREE.WebGLRenderer(
{
    antialias:true
});


renderer.setSize(
    window.innerWidth,
    window.innerHeight
);


document.body.appendChild(
    renderer.domElement
);



// ===============================
// CONTROLS
// ===============================


const controls =
new OrbitControls(
    camera,
    renderer.domElement
);


controls.enableDamping = true;

controls.target.set(
    0,
    0,
    0
);

controls.update();



// ===============================
// TETRAHEDRON
// ===============================


const tetrahedron =
new THREE.Mesh(

    new THREE.TetrahedronGeometry(
        2
    ),

    new THREE.MeshBasicMaterial(
    {
        color:0xaaaaaa,
        wireframe:true,
        transparent:true,
        opacity:0.35
    })

);


scene.add(
    tetrahedron
);



// ===============================
// LABELS
// ===============================


function createLabel(
    text,
    position
)
{

    const canvas =
    document.createElement(
        "canvas"
    );


    canvas.width = 256;
    canvas.height = 128;


    const ctx =
    canvas.getContext(
        "2d"
    );


    ctx.fillStyle =
    "white";


    ctx.font =
    "70px monospace";


    ctx.fillText(
        text,
        20,
        80
    );


    const texture =
    new THREE.CanvasTexture(
        canvas
    );


    const sprite =
    new THREE.Sprite(
        new THREE.SpriteMaterial(
        {
            map:texture,
            transparent:true
        })
    );


    sprite.position.copy(
        position
    );


    sprite.scale.set(
        0.7,
        0.35,
        1
    );


    scene.add(
        sprite
    );

}



for(
    const [letter, vector]
    of Object.entries(vectors)
)
{

    createLabel(
        letter,
        vector.clone()
        .multiplyScalar(2.5)
    );

}



// ===============================
// AXES ORIGIN MARKER
// ===============================


const centre =
new THREE.Mesh(

    new THREE.SphereGeometry(
        0.08
    ),

    new THREE.MeshBasicMaterial(
    {
        color:0xffffff
    })

);


scene.add(
    centre
);



// ===============================
// ANIMATION
// ===============================


function animate()
{

    requestAnimationFrame(
        animate
    );


    controls.update();


    renderer.render(
        scene,
        camera
    );

}


animate();



// ===============================
// RESIZE
// ===============================


window.addEventListener(
"resize",
()=>{

    camera.aspect =
    window.innerWidth /
    window.innerHeight;


    camera.updateProjectionMatrix();


    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

});



console.log(
    "Ronald Explorer core loaded"
);