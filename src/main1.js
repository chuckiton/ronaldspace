import * as THREE from "three";

import {
    OrbitControls
}
from "three/addons/controls/OrbitControls.js";

const ronaldFont = new FontFace(
    "ProFont",
    "url(fonts/ProFontNerdFont-Regular.ttf)"
);


ronaldFont.load()
.then(
    font =>
    {
        document.fonts.add(font);
        createVertexLabels();
    }
);
// ======================================
// RONALD SPACE
// ======================================


const vectors = {

    R: new THREE.Vector3( 1,  1,  1 ),
    N: new THREE.Vector3(-1, -1,  1 ),
    L: new THREE.Vector3(-1,  1, -1 ),
    D: new THREE.Vector3( 1, -1, -1 )

};



// ======================================
// SCENE
// ======================================


const scene = new THREE.Scene();

scene.background =
new THREE.Color(0x2b2d30);



// ======================================
// CAMERA
// ======================================


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



// ======================================
// RENDERER
// ======================================


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



// ======================================
// CONTROLS
// ======================================


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



// ======================================
// TETRAHEDRAL BOUNDARY
// ======================================


const boundary =
new THREE.LineSegments(

    new THREE.EdgesGeometry(
        new THREE.TetrahedronGeometry(2)
    ),

    new THREE.LineBasicMaterial(
    {
        color:0x777777,
        transparent:true,
        opacity:0.35
    })

);


scene.add(
    boundary
);



// ======================================
// LABELS
// ======================================


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
    "70px ProFont";


    ctx.fillText(
        text,
        20,
        80
    );


    const sprite =
    new THREE.Sprite(
        new THREE.SpriteMaterial(
        {
            map:
            new THREE.CanvasTexture(
                canvas
            ),
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


function createVertexLabels()
{

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

}

// ======================================
// POSSIBILITY NODES
// ======================================

function createNodes()
{

    const points = [];

    const seen = new Set();


    function addPoint(position)
    {

        const key =
        position.x.toFixed(3)+","+
        position.y.toFixed(3)+","+
        position.z.toFixed(3);


        if(!seen.has(key))
        {
            seen.add(key);
            points.push(position);
        }

    }



    function recurse(
        current,
        depth
    )
    {

        addPoint(
            current.clone()
        );


        if(depth===4)
            return;


        for(
            const letter of Object.keys(vectors)
        )
        {

            recurse(
                current.clone()
                .add(
                    vectors[letter]
                ),
                depth+1
            );

        }

    }


    recurse(
        new THREE.Vector3(0,0,0),
        0
    );



    const geometry =
    new THREE.BufferGeometry()
    .setFromPoints(
        points
    );


    const material =
    new THREE.PointsMaterial(
    {
        color:0x888888,
        size:0.035,
        transparent:true,
        opacity:0.45
    });


    const nodes =
    new THREE.Points(
        geometry,
        material
    );


    scene.add(
        nodes
    );

}


createNodes();



// ======================================
// RONALD PATH
// ======================================


function ronaldCode(name)
{

    return [

        name[0],
        name[2],
        name[4],
        name[5]

    ];

}



function createRonaldPath(
    name
)
{

    const code =
    ronaldCode(
        name
    );


    const points=[
        new THREE.Vector3(0,0,0)
    ];


    let current =
    new THREE.Vector3(
        0,
        0,
        0
    );


    code.forEach(
        letter =>
        {

            current =
            current.clone()
            .add(
                vectors[letter]
            );


            points.push(
                current.clone()
            );

        }
    );



    const curve =
    new THREE.CatmullRomCurve3(
        points
    );



    const geometry =
    new THREE.BufferGeometry();



    const material =
    new THREE.LineBasicMaterial(
    {
        color:0xffffff,
        linewidth:10
    });



    const line =
    new THREE.Line(
        geometry,
        material
    );


    scene.add(
        line
    );



    let progress=0;


    function animatePath()
    {

        progress += 0.003;


        if(progress>1)
            progress=1;


        const visible=[];


        const steps=100;


        for(
            let i=0;
            i<=progress*steps;
            i++
        )
        {

            visible.push(
                curve.getPoint(
                    i/steps
                )
            );

        }


        geometry.setFromPoints(
            visible
        );


        if(progress<1)
        {
            requestAnimationFrame(
                animatePath
            );
        }

    }


    animatePath();

}


createRonaldPath(
    "RONALD"
);



// ======================================
// LOOP
// ======================================


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



// ======================================
// RESIZE
// ======================================


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