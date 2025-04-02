import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

const AutonomousDrivingSimulation = () => {
  const mountRef = useRef(null);
  const requestRef = useRef(null);
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);
  const [laneKeepingActive, setLaneKeepingActive] = useState(true);
  const [adaptiveCruiseActive, setAdaptiveCruiseActive] = useState(true);
  const [speed, setSpeed] = useState(0);
  const [distance, setDistance] = useState(0);
  
  const simulationRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    car: null,
    road: null,
    roadLength: 500, // Reduced road length for better performance
    roadWidth: 12,
    laneWidth: 4,
    roadCurves: [],
    carSpeed: 0.3,
    targetSpeed: 0.3,
    carPosition: new THREE.Vector3(0, 0.5, 0),
    carRotation: 0,
    clock: new THREE.Clock(),
    obstacles: [],
    sensors: {
      front: null,
      left: null,
      right: null
    },
    sensorReadings: {
      front: Infinity,
      left: Infinity,
      right: Infinity
    },
    distance: 0,
    initialized: false,
    debugHelpers: []
  });

  // Create a single road segment with realistic asphalt texture
  const createRoadSegment = useCallback((width, length, angle) => {
    const group = new THREE.Group();
    
    // Road surface - asphalt (dark gray)
    const roadGeometry = new THREE.PlaneGeometry(width, length);
    const roadMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x1a1a1a,  // Very dark gray for asphalt
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    
    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.rotation.x = Math.PI / 2;
    road.position.z = length / 2;
    road.receiveShadow = true;
    group.add(road);
    
    // Road lane markings - bright white
    const laneWidth = 0.3;
    const leftLaneGeometry = new THREE.PlaneGeometry(laneWidth, length);
    const rightLaneGeometry = new THREE.PlaneGeometry(laneWidth, length);
    const laneMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffffff,
      side: THREE.DoubleSide
    });
    
    const leftLane = new THREE.Mesh(leftLaneGeometry, laneMaterial);
    leftLane.rotation.x = Math.PI / 2;
    leftLane.position.set(-(width / 2) + 0.5, 0.01, length / 2);
    
    const rightLane = new THREE.Mesh(rightLaneGeometry, laneMaterial);
    rightLane.rotation.x = Math.PI / 2;
    rightLane.position.set((width / 2) - 0.5, 0.01, length / 2);
    
    group.add(leftLane);
    group.add(rightLane);
    
    // Add center dashed line (yellow)
    const centerLineMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffcc00, // Yellow
      side: THREE.DoubleSide
    });
    
    const dashLength = 3;
    const dashGap = 2;
    const numDashes = Math.floor(length / (dashLength + dashGap));
    
    for (let i = 0; i < numDashes; i++) {
      const dashGeometry = new THREE.PlaneGeometry(laneWidth, dashLength);
      const dash = new THREE.Mesh(dashGeometry, centerLineMaterial);
      dash.rotation.x = Math.PI / 2;
      
      // Position each dash along the road
      const startPos = i * (dashLength + dashGap);
      dash.position.set(0, 0.01, startPos + dashLength/2);
      
      group.add(dash);
    }
    
    return group;
  }, []);

  // Create an obstacle
  const createObstacle = useCallback(() => {
    // Create a car-like shape instead of a simple cube
    const obstacleGroup = new THREE.Group();
    
    // Car body
    const bodyGeometry = new THREE.BoxGeometry(2, 1, 4);
    const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.5;
    body.castShadow = true;
    obstacleGroup.add(body);
    
    // Car roof
    const roofGeometry = new THREE.BoxGeometry(1.8, 0.7, 2);
    const roofMaterial = new THREE.MeshPhongMaterial({ color: 0xbb0000 });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 1.35;
    roof.position.z = -0.5;
    roof.castShadow = true;
    obstacleGroup.add(roof);
    
    // Wheels
    const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
    const wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x111111 });
    
    // Front-left wheel
    const wheelFL = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheelFL.rotation.z = Math.PI / 2;
    wheelFL.position.set(-1.1, 0.4, 1.2);
    obstacleGroup.add(wheelFL);
    
    // Front-right wheel
    const wheelFR = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheelFR.rotation.z = Math.PI / 2;
    wheelFR.position.set(1.1, 0.4, 1.2);
    obstacleGroup.add(wheelFR);
    
    // Back-left wheel
    const wheelBL = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheelBL.rotation.z = Math.PI / 2;
    wheelBL.position.set(-1.1, 0.4, -1.2);
    obstacleGroup.add(wheelBL);
    
    // Back-right wheel
    const wheelBR = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheelBR.rotation.z = Math.PI / 2;
    wheelBR.position.set(1.1, 0.4, -1.2);
    obstacleGroup.add(wheelBR);
    
    return obstacleGroup;
  }, []);

  // Setup car object
  const setupCar = useCallback(() => {
    const simulation = simulationRef.current;
    
    // Create a car group
    const carGroup = new THREE.Group();
    simulation.car = carGroup;
    simulation.scene.add(carGroup);
    
    // Car body
    const bodyGeometry = new THREE.BoxGeometry(2, 1, 4);
    const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.5;
    body.castShadow = true;
    carGroup.add(body);
    
    // Car roof
    const roofGeometry = new THREE.BoxGeometry(1.8, 0.7, 2);
    const roofMaterial = new THREE.MeshPhongMaterial({ color: 0x00aa00 });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 1.35;
    roof.position.z = -0.5;
    roof.castShadow = true;
    carGroup.add(roof);
    
    // Wheels
    const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
    const wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x111111 });
    
    // Front-left wheel
    const wheelFL = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheelFL.rotation.z = Math.PI / 2;
    wheelFL.position.set(-1.1, 0.4, 1.2);
    carGroup.add(wheelFL);
    
    // Front-right wheel
    const wheelFR = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheelFR.rotation.z = Math.PI / 2;
    wheelFR.position.set(1.1, 0.4, 1.2);
    carGroup.add(wheelFR);
    
    // Back-left wheel
    const wheelBL = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheelBL.rotation.z = Math.PI / 2;
    wheelBL.position.set(-1.1, 0.4, -1.2);
    carGroup.add(wheelBL);
    
    // Back-right wheel
    const wheelBR = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheelBR.rotation.z = Math.PI / 2;
    wheelBR.position.set(1.1, 0.4, -1.2);
    carGroup.add(wheelBR);
    
    // Add sensors
    const sensorGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const sensorMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    
    // Front sensor
    simulation.sensors.front = new THREE.Mesh(sensorGeometry, sensorMaterial);
    simulation.sensors.front.position.set(0, 0.5, 2);
    carGroup.add(simulation.sensors.front);
    
    // Left sensor
    simulation.sensors.left = new THREE.Mesh(sensorGeometry, sensorMaterial);
    simulation.sensors.left.position.set(-1, 0.5, 0);
    carGroup.add(simulation.sensors.left);
    
    // Right sensor
    simulation.sensors.right = new THREE.Mesh(sensorGeometry, sensorMaterial);
    simulation.sensors.right.position.set(1, 0.5, 0);
    carGroup.add(simulation.sensors.right);
    
    // Position car
    carGroup.position.copy(simulation.carPosition);
    carGroup.rotation.y = simulation.carRotation;
  }, []);

  // Generate random road
  const generateRoad = useCallback(() => {
    console.log("Generating road...");
    const simulation = simulationRef.current;
    
    // Remove existing road if any
    if (simulation.road) {
      simulation.scene.remove(simulation.road);
    }
    
    // Clear obstacles
    if (simulation.obstacles && simulation.obstacles.length > 0) {
      simulation.obstacles.forEach(obstacle => {
        simulation.scene.remove(obstacle);
      });
      simulation.obstacles = [];
    }
    
    // Clear debug helpers
    if (simulation.debugHelpers && simulation.debugHelpers.length > 0) {
      simulation.debugHelpers.forEach(helper => {
        simulation.scene.remove(helper);
      });
      simulation.debugHelpers = [];
    }
    
    // Create a road group to hold all road segments
    simulation.road = new THREE.Group();
    simulation.scene.add(simulation.road);
    
    // Road parameters
    const roadLength = simulation.roadLength;
    const roadWidth = simulation.roadWidth;
    const segments = 20; // Fewer segments for better performance
    const segmentLength = roadLength / segments;
    
    // Generate road curves
    simulation.roadCurves = [];
    let currentX = 0;
    let currentZ = 0;
    let currentAngle = 0;
    
    for (let i = 0; i < segments; i++) {
      // Random curve intensity (positive = right, negative = left)
      // Start with straight segments and then add gentle curves
      const curvature = (i < 3) ? 0 : (Math.random() * 0.03 - 0.015);
      
      simulation.roadCurves.push({
        position: { x: currentX, z: currentZ },
        angle: currentAngle,
        curvature: curvature
      });
      
      // Update position and angle for next segment
      currentAngle += curvature;
      currentX += Math.sin(currentAngle) * segmentLength;
      currentZ += Math.cos(currentAngle) * segmentLength;
    }
    
    // Create road segments
    for (let i = 0; i < segments; i++) {
      const curve = simulation.roadCurves[i];
      const roadSegment = createRoadSegment(roadWidth, segmentLength, curve.angle);
      roadSegment.position.set(curve.position.x, 0, curve.position.z);
      roadSegment.rotation.y = curve.angle;
      simulation.road.add(roadSegment);
      
      // Add debug marker at each segment start point (small red sphere)
      const markerGeometry = new THREE.SphereGeometry(0.2, 8, 8);
      const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.set(curve.position.x, 0.2, curve.position.z);
      simulation.scene.add(marker);
      simulation.debugHelpers.push(marker);
      
      // Randomly add obstacles but not in the first few segments
      if (Math.random() < 0.2 && i > 3) {
        const obstacle = createObstacle();
        const laneOffset = (Math.random() > 0.5 ? 1 : -1) * (roadWidth / 4);
        
        // Position obstacle on the road with correct orientation
        obstacle.position.set(
          curve.position.x + Math.sin(curve.angle) * laneOffset,
          0,
          curve.position.z + Math.cos(curve.angle) * laneOffset
        );
        obstacle.rotation.y = curve.angle;
        
        simulation.scene.add(obstacle);
        simulation.obstacles.push(obstacle);
      }
    }
    
    // Reset car position to start of road
    simulation.carPosition = new THREE.Vector3(0, 0.5, 0);
    simulation.carRotation = 0;
    
    // Update car position and rotation
    if (simulation.car) {
      simulation.car.position.copy(simulation.carPosition);
      simulation.car.rotation.y = simulation.carRotation;
    }
    
    // Reset counters
    simulation.distance = 0;
    setDistance(0);
    setSpeed(0);
    
    console.log("Road generated with", segments, "segments");
  }, [createRoadSegment, createObstacle]);

  // Update camera position
  const updateCamera = useCallback(() => {
    const simulation = simulationRef.current;
    if (!simulation.car) return;
    
    // Set camera position above and behind the car
    const cameraOffsetY = 7;
    const cameraOffsetZ = -15;
    
    const cameraPosition = new THREE.Vector3();
    
    // Rotate camera position around car based on car rotation
    cameraPosition.x = simulation.car.position.x - Math.sin(simulation.carRotation) * Math.abs(cameraOffsetZ);
    cameraPosition.y = simulation.car.position.y + cameraOffsetY;
    cameraPosition.z = simulation.car.position.z - Math.cos(simulation.carRotation) * Math.abs(cameraOffsetZ);
    
    simulation.camera.position.copy(cameraPosition);
    simulation.camera.lookAt(simulation.car.position);
  }, []);

  // Update sensor readings
  const updateSensors = useCallback(() => {
    const simulation = simulationRef.current;
    if (!simulation.car || !simulation.sensors.front || !simulation.obstacles) return;
    
    // Raycaster for sensor detection
    const raycaster = new THREE.Raycaster();
    
    // Front sensor
    const frontSensorPosition = new THREE.Vector3();
    simulation.sensors.front.getWorldPosition(frontSensorPosition);
    
    const frontDirection = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(simulation.car.quaternion)
      .normalize();
    
    raycaster.set(frontSensorPosition, frontDirection);
    const frontIntersects = raycaster.intersectObjects(simulation.obstacles, true);
    
    simulation.sensorReadings.front = frontIntersects.length > 0 
      ? frontIntersects[0].distance 
      : Infinity;
    
    // Left sensor
    const leftSensorPosition = new THREE.Vector3();
    simulation.sensors.left.getWorldPosition(leftSensorPosition);
    
    const leftDirection = new THREE.Vector3(-1, 0, 0)
      .applyQuaternion(simulation.car.quaternion)
      .normalize();
    
    raycaster.set(leftSensorPosition, leftDirection);
    const leftIntersects = raycaster.intersectObjects(simulation.obstacles, true);
    
    simulation.sensorReadings.left = leftIntersects.length > 0 
      ? leftIntersects[0].distance 
      : Infinity;
    
    // Right sensor
    const rightSensorPosition = new THREE.Vector3();
    simulation.sensors.right.getWorldPosition(rightSensorPosition);
    
    const rightDirection = new THREE.Vector3(1, 0, 0)
      .applyQuaternion(simulation.car.quaternion)
      .normalize();
    
    raycaster.set(rightSensorPosition, rightDirection);
    const rightIntersects = raycaster.intersectObjects(simulation.obstacles, true);
    
    simulation.sensorReadings.right = rightIntersects.length > 0 
      ? rightIntersects[0].distance 
      : Infinity;
  }, []);

  // Adaptive cruise control algorithm
  const updateAdaptiveCruiseControl = useCallback(() => {
    const simulation = simulationRef.current;
    const frontDistance = simulation.sensorReadings.front;
    
    // Base target speed
    const baseSpeed = 0.3;
    
    if (frontDistance < 10) {
      // Slow down if obstacle detected ahead
      const slowdownFactor = Math.max(0.1, frontDistance / 10);
      simulation.targetSpeed = baseSpeed * slowdownFactor;
    } else {
      // Otherwise maintain normal speed
      simulation.targetSpeed = baseSpeed;
    }
  }, []);

  // Lane keeping algorithm
  const updateLaneKeeping = useCallback(() => {
    const simulation = simulationRef.current;
    if (!simulation.car || !simulation.roadCurves || simulation.roadCurves.length === 0) return;
    
    // Get car position
    const carPosition = new THREE.Vector3();
    carPosition.copy(simulation.car.position);
    
    // Find the nearest road segment
    let nearestSegmentIndex = 0;
    let minDistance = Infinity;
    
    for (let i = 0; i < simulation.roadCurves.length; i++) {
      const segment = simulation.roadCurves[i];
      const distance = Math.sqrt(
        Math.pow(carPosition.x - segment.position.x, 2) +
        Math.pow(carPosition.z - segment.position.z, 2)
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestSegmentIndex = i;
      }
    }
    
    // Get current segment for path prediction
    const currentSegment = simulation.roadCurves[nearestSegmentIndex];
    
    // Calculate offset from road center
    const roadAngle = currentSegment.angle;
    const roadCenterX = currentSegment.position.x;
    const roadCenterZ = currentSegment.position.z;
    
    // Calculate the car's offset from the road center
    const relativeX = carPosition.x - roadCenterX;
    const relativeZ = carPosition.z - roadCenterZ;
    
    // Rotate to road's coordinate system
    const rotatedX = relativeX * Math.cos(-roadAngle) - relativeZ * Math.sin(-roadAngle);
    
    // Calculate desired steering based on lateral offset and road curvature
    const lateralOffset = rotatedX;
    const steeringCorrection = -lateralOffset * 0.5;
    
    // Add predictive steering based on upcoming road curvature
    const predictiveSteering = currentSegment.curvature * 10;
    
    // Apply steering
    simulation.carRotation += (steeringCorrection + predictiveSteering) * simulation.carSpeed;
    simulation.car.rotation.y = simulation.carRotation;
  }, []);

  // Update simulation state
  const updateSimulation = useCallback(() => {
    const simulation = simulationRef.current;
    if (!simulation.car || !simulation.initialized) return;
    
    const delta = simulation.clock.getDelta();
    
    // Update car's target speed based on adaptive cruise control
    if (adaptiveCruiseActive) {
      updateAdaptiveCruiseControl();
    }
    
    // Smoothly adjust current speed toward target speed
    simulation.carSpeed += (simulation.targetSpeed - simulation.carSpeed) * 0.1;
    
    // Move car forward
    const distanceStep = simulation.carSpeed * delta * 20; 
    
    // Calculate new position based on car's forward direction
    const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), simulation.carRotation);
    
    simulation.carPosition.x += forward.x * distanceStep;
    simulation.carPosition.z += forward.z * distanceStep;
    
    // Update car mesh position
    simulation.car.position.copy(simulation.carPosition);
    
    // Update distance traveled
    simulation.distance += distanceStep;
    setDistance(Math.floor(simulation.distance));
    setSpeed(Math.floor(simulation.carSpeed * 100));
    
    // Lane keeping
    if (laneKeepingActive) {
      updateLaneKeeping();
    }
    
    // Update sensors and readings
    updateSensors();
    
    // Update camera position to follow car
    updateCamera();
    
    // End simulation if we've reached the end of the road
    if (simulation.distance > simulation.roadLength) {
      setIsSimulationRunning(false);
      console.log("End of road reached");
    }
  }, [adaptiveCruiseActive, laneKeepingActive, updateAdaptiveCruiseControl, updateCamera, updateLaneKeeping, updateSensors]);

  // Animation loop
  const animate = useCallback(() => {
    const simulation = simulationRef.current;
    
    if (isSimulationRunning) {
      updateSimulation();
    }
    
    if (simulation.renderer && simulation.scene && simulation.camera) {
      simulation.renderer.render(simulation.scene, simulation.camera);
    }
    
    requestRef.current = requestAnimationFrame(animate);
  }, [isSimulationRunning, updateSimulation]);

  // Handle scene initialization
  useEffect(() => {
    const simulation = simulationRef.current;
    const mount = mountRef.current;
    
    if (!mount) return;

    // Create scene
    simulation.scene = new THREE.Scene();
    simulation.scene.background = new THREE.Color(0x87CEEB); // Sky blue
    
    // Create camera
    simulation.camera = new THREE.PerspectiveCamera(
      75, 
      mount.clientWidth / mount.clientHeight, 
      0.1, 
      2000
    );
    
    // Create renderer
    simulation.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      powerPreference: "high-performance"
    });
    simulation.renderer.setSize(mount.clientWidth, mount.clientHeight);
    simulation.renderer.setPixelRatio(window.devicePixelRatio);
    simulation.renderer.shadowMap.enabled = true;
    simulation.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(simulation.renderer.domElement);
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    simulation.scene.add(ambientLight);
    
    // Add directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    
    // Set up shadow properties
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    
    simulation.scene.add(directionalLight);
    
    // Add ground plane
    const groundGeometry = new THREE.PlaneGeometry(500, 500);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x228B22, // Forest green
      roughness: 1.0,
      metalness: 0.0,
      side: THREE.DoubleSide
    });
    
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = Math.PI / 2;
    ground.position.y = -0.1; // Slightly below road level
    ground.receiveShadow = true;
    simulation.scene.add(ground);
    
    // Setup car
    setupCar();
    
    // Set camera initial position
    simulation.camera.position.set(0, 10, -15);
    simulation.camera.lookAt(simulation.car.position);
    
    // Create initial road
    generateRoad();
    
    // Mark as initialized
    simulation.initialized = true;
    
    // Handle window resize
    const handleResize = () => {
      simulation.camera.aspect = mount.clientWidth / mount.clientHeight;
      simulation.camera.updateProjectionMatrix();
      simulation.renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Start animation loop
    simulation.clock.start();
    requestRef.current = requestAnimationFrame(animate);
    
    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(requestRef.current);
      if (mount.contains(simulation.renderer.domElement)) {
        mount.removeChild(simulation.renderer.domElement);
      }
      simulation.scene.clear();
    };
  }, [animate, setupCar, generateRoad]);

  // Handle start simulation button
  const handleStartSimulation = () => {
    console.log("Starting simulation...");
    if (!isSimulationRunning) {
      // Regenerate road for a new simulation
      generateRoad();
      
      // Reset clock and start simulation
      simulationRef.current.clock.start();
      setIsSimulationRunning(true);
    }
  };
  
  // Handle stop simulation button
  const handleStopSimulation = () => {
    if (isSimulationRunning) {
      setIsSimulationRunning(false);
    }
  };
  
  return (
    <div className="w-full h-full flex flex-col">
      <div className="bg-gray-800 p-4 text-white">
        <h1 className="text-2xl font-bold mb-2">Autonomous Driving Simulation</h1>
        <div className="flex flex-wrap gap-4 items-center">
          <button 
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            onClick={handleStartSimulation}
            disabled={isSimulationRunning}
          >
            Start Simulation
          </button>
          <button 
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
            onClick={handleStopSimulation}
            disabled={!isSimulationRunning}
          >
            Stop Simulation
          </button>
          
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="laneKeeping" 
              checked={laneKeepingActive} 
              onChange={() => setLaneKeepingActive(!laneKeepingActive)}
            />
            <label htmlFor="laneKeeping">Lane Keeping</label>
          </div>
          
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="adaptiveCruise" 
              checked={adaptiveCruiseActive} 
              onChange={() => setAdaptiveCruiseActive(!adaptiveCruiseActive)}
            />
            <label htmlFor="adaptiveCruise">Adaptive Cruise Control</label>
          </div>
          
          <div className="ml-4">
            <span className="font-semibold">Speed:</span> {speed} km/h
          </div>
          <div>
            <span className="font-semibold">Distance:</span> {distance} m
          </div>
        </div>
      </div>
      
      <div 
        ref={mountRef} 
        className="flex-grow bg-black"
        style={{ height: "calc(100vh - 100px)" }}
      />
    </div>
  );
};

export default AutonomousDrivingSimulation;