window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('fissionCanvas');
    const ctx = canvas.getContext('2d');
    const stage = document.getElementById('simulationStage');
    const startBtn = document.getElementById('startBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const singleModeBtn = document.getElementById('singleModeBtn');
    const chainModeBtn = document.getElementById('chainModeBtn');
    const statusBadge = document.getElementById('status-badge');
    const modeDescription = document.getElementById('modeDescription');
    const modeInfoText = document.getElementById('modeInfoText');
    const energyVal = document.getElementById('energyVal');
    const fissionCountEl = document.getElementById('fissionCount');
    const energyBar = document.getElementById('energyBar');
    const energyPercent = document.getElementById('energyPercent');

    const chainColumns = 4;
    const chainRows = 3;
    const chainCapacity = chainColumns * chainRows;
    const singleDuration = 6.2;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let currentMode = 'single';
    let isRunning = false;
    let animationId = 0;
    let previousFrameTime = 0;
    let singleElapsed = 0;
    let chainNuclei = [];
    let chainNeutrons = [];
    let totalFissions = 0;
    let accumulatedEnergy = 0;
    let neutronId = 0;
    let chainRespawnAt = 0;

    function updateStatus(text, classes) {
        statusBadge.textContent = text;
        statusBadge.className = `px-2.5 py-0.5 rounded-full text-xs font-semibold ${classes}`;
    }

    function updateMetrics(energy, fissions, progress) {
        energyVal.textContent = energy.toFixed(1);
        fissionCountEl.textContent = String(fissions);
        energyBar.style.width = `${progress}%`;
        energyPercent.textContent = `${progress}%`;
    }

    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const oldWidth = width;
        const oldHeight = height;
        width = rect.width;
        height = rect.height;
        pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);
        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        if (currentMode === 'chain' && oldWidth && oldHeight) {
            const scaleX = width / oldWidth;
            const scaleY = height / oldHeight;
            chainNuclei.forEach(nucleus => {
                nucleus.x *= scaleX;
                nucleus.y *= scaleY;
                nucleus.radius = nucleusRadius();
            });
            chainNeutrons.forEach(neutron => {
                neutron.x *= scaleX;
                neutron.y *= scaleY;
                neutron.vx *= scaleX;
                neutron.vy *= scaleY;
            });
        }

        drawScene();
    }

    function nucleusRadius() {
        return Math.max(18, Math.min(31, width * 0.035));
    }

    function createChain() {
        const xGap = width * 0.19;
        const yGap = height * 0.27;
        const xStart = width * 0.22;
        const yStart = height * 0.23;
        const radius = nucleusRadius();

        chainNuclei = [];
        for (let row = 0; row < chainRows; row += 1) {
            for (let column = 0; column < chainColumns; column += 1) {
                chainNuclei.push({
                    x: xStart + column * xGap + (row % 2) * width * 0.025,
                    y: yStart + row * yGap,
                    radius,
                    intact: true,
                    wobble: Math.random() * Math.PI * 2
                });
            }
        }

        chainNeutrons = [];
        addNeutron(width * 0.06, height * 0.5, 1, 0, true);
        chainRespawnAt = 0;
    }

    function addNeutron(x, y, vx, vy, incoming = false) {
        const speed = Math.hypot(vx, vy) || 1;
        chainNeutrons.push({
            id: neutronId++,
            x,
            y,
            vx: (vx / speed) * 205,
            vy: (vy / speed) * 205,
            trail: [],
            active: true,
            incoming
        });
    }

    function resetSimulation() {
        isRunning = false;
        cancelAnimationFrame(animationId);
        animationId = 0;
        previousFrameTime = 0;
        singleElapsed = 0;
        totalFissions = 0;
        accumulatedEnergy = 0;
        chainRespawnAt = 0;
        stage.classList.toggle('mode-single', currentMode === 'single');
        stage.classList.toggle('mode-chain', currentMode === 'chain');
        updateMetrics(0, 0, 0);
        updateStatus('Paused', 'bg-amber-100 text-amber-700 border-amber-200');
        startBtn.innerHTML = '<i class="fa-solid fa-play"></i> Start';

        if (currentMode === 'chain' && width && height) createChain();
        drawScene();
    }

    function drawNucleus(x, y, radius, label, color, wobble = 0) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(wobble);

        const glow = ctx.createRadialGradient(0, 0, radius * 0.4, 0, 0, radius * 1.9);
        glow.addColorStop(0, `${color}24`);
        glow.addColorStop(1, `${color}00`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.9, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `${color}55`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * 1.45, radius * 0.63, 0.4, 0, Math.PI * 2);
        ctx.stroke();

        const nucleusGradient = ctx.createRadialGradient(-radius * 0.35, -radius * 0.4, 1, 0, 0, radius);
        nucleusGradient.addColorStop(0, '#ffffff');
        nucleusGradient.addColorStop(1, color === '#3b82f6' ? '#dbeafe' : '#ede9fe');
        ctx.fillStyle = nucleusGradient;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const nucleonCount = radius < 23 ? 16 : 28;
        const spacing = Math.sqrt((radius * radius * 0.72) / nucleonCount);
        for (let index = 0; index < nucleonCount; index += 1) {
            const angle = index * 2.399963229728653;
            const distance = Math.sqrt((index + 0.5) / nucleonCount) * radius * 0.79;
            const nx = Math.cos(angle) * distance;
            const ny = Math.sin(angle) * distance;
            const dotRadius = Math.max(2.1, Math.min(4, radius * 0.115));
            ctx.beginPath();
            ctx.arc(nx, ny, dotRadius, 0, Math.PI * 2);
            ctx.fillStyle = index % 2 === 0 ? '#ef4444' : '#cbd5e1';
            ctx.strokeStyle = index % 2 === 0 ? '#b91c1c' : '#94a3b8';
            ctx.lineWidth = 0.6;
            ctx.fill();
            ctx.stroke();
        }

        ctx.restore();
        ctx.fillStyle = '#334155';
        ctx.font = `600 ${Math.max(10, Math.min(13, radius * 0.43))}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(label, x, y + radius + 11);
    }

    function drawNeutron(x, y, radius = 8, tail = null) {
        ctx.save();
        if (tail && Math.hypot(x - tail.x, y - tail.y) > 1) {
            const trail = ctx.createLinearGradient(tail.x, tail.y, x, y);
            trail.addColorStop(0, 'rgba(30, 41, 59, 0)');
            trail.addColorStop(1, 'rgba(30, 41, 59, 0.36)');
            ctx.strokeStyle = trail;
            ctx.lineWidth = radius * 0.9;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(tail.x, tail.y);
            ctx.lineTo(x, y);
            ctx.stroke();
        }

        ctx.shadowColor = 'rgba(30, 41, 59, 0.3)';
        ctx.shadowBlur = radius * 1.7;
        ctx.shadowOffsetY = 2;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillStyle = '#fff';
        ctx.font = `700 ${radius * 1.2}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('n', x, y + 0.5);
        ctx.restore();
    }

    function drawFragment(x, y, radius, color, label) {
        const glow = ctx.createRadialGradient(x, y, radius * 0.35, x, y, radius * 1.8);
        glow.addColorStop(0, `${color}35`);
        glow.addColorStop(1, `${color}00`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, radius * 1.8, 0, Math.PI * 2);
        ctx.fill();

        const gradient = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.35, 1, x, y, radius);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(1, color === '#ec4899' ? '#fbcfe8' : '#a5f3fc');
        ctx.fillStyle = gradient;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        for (let index = 0; index < 9; index += 1) {
            const angle = index * 2.399963229728653;
            const distance = Math.sqrt((index + 0.5) / 9) * radius * 0.7;
            ctx.beginPath();
            ctx.arc(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, 2.4, 0, Math.PI * 2);
            ctx.fillStyle = index % 2 === 0 ? color : '#f8fafc';
            ctx.fill();
        }

        ctx.fillStyle = '#334155';
        ctx.font = '600 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(label, x, y + radius + 8);
    }

    function drawEnergy(x, y, alpha = 1) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = '700 14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const text = '~200 MeV';
        const textWidth = ctx.measureText(text).width;
        const boxWidth = textWidth + 24;
        ctx.fillStyle = '#fffbeb';
        ctx.strokeStyle = '#fcd34d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x - boxWidth / 2, y - 15, boxWidth, 30, 15);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#b45309';
        ctx.fillText(text, x, y);
        ctx.restore();
    }

    function drawScene(timestamp = 0) {
        if (!width || !height) return;
        ctx.clearRect(0, 0, width, height);

        if (currentMode === 'single') {
            drawSingle(timestamp);
            return;
        }

        chainNuclei.forEach((nucleus, index) => {
            const label = nucleus.intact ? `²³⁵U #${index + 1}` : '';
            if (nucleus.intact) {
                drawNucleus(nucleus.x, nucleus.y, nucleus.radius, label, '#3b82f6',
                    Math.sin(timestamp / 1000 + nucleus.wobble) * 0.018);
            } else {
                drawFragment(nucleus.x - 14, nucleus.y - 7, nucleus.radius * 0.56, '#ec4899', '');
                drawFragment(nucleus.x + 14, nucleus.y + 7, nucleus.radius * 0.46, '#06b6d4', '');
            }
        });

        chainNeutrons.forEach(neutron => {
            const tail = neutron.trail[0];
            drawNeutron(neutron.x, neutron.y, Math.max(7, nucleusRadius() * 0.27), tail);
        });
    }

    function drawSingle(timestamp) {
        const centerX = width * 0.49;
        const centerY = height * 0.5;
        const radius = Math.max(31, Math.min(48, Math.min(width, height) * 0.12));
        const time = isRunning ? singleElapsed : 0;

        if (time < 1.8) {
            const progress = Math.min(time / 1.8, 1);
            const neutronX = width * 0.14 + (centerX - radius * 1.5 - width * 0.14) * progress;
            drawNucleus(centerX, centerY, radius, '²³⁵U', '#3b82f6');
            drawNeutron(neutronX, centerY, 9, { x: neutronX - 24, y: centerY });
            drawEnergy(width * 0.8, height * 0.18, progress * 0.2);
            return;
        }

        if (time < 3.4) {
            const wobble = Math.sin(timestamp / 35) * 3;
            drawNucleus(centerX, centerY, radius + wobble, '²³⁶U (Unstable)', '#8b5cf6',
                Math.sin(timestamp / 55) * 0.035);
            drawEnergy(width * 0.8, height * 0.18, 0.4);
            return;
        }

        const progress = Math.min((time - 3.4) / 2.8, 1);
        const distance = progress * Math.min(width * 0.18, 140);
        drawFragment(centerX + distance * 0.72, centerY - distance * 0.42, radius * 0.68, '#ec4899', '¹⁴⁴Ba');
        drawFragment(centerX + distance * 0.72, centerY + distance * 0.42, radius * 0.54, '#06b6d4', '⁸⁹Kr');

        const neutronRadius = Math.max(7, radius * 0.2);
        const neutronPositions = [
            { x: centerX + distance * 1.4, y: centerY - distance * 0.68 },
            { x: centerX + distance * 1.52, y: centerY },
            { x: centerX + distance * 1.4, y: centerY + distance * 0.68 }
        ];
        neutronPositions.forEach(position => {
            drawNeutron(position.x, position.y, neutronRadius, { x: position.x - 26, y: position.y });
        });
        drawEnergy(width * 0.8, height * 0.18, Math.min(1, progress * 2));
    }

    function splitNucleus(nucleus, neutron) {
        nucleus.intact = false;
        neutron.active = false;
        totalFissions += 1;
        accumulatedEnergy += 200;

        const targets = chainNuclei
            .filter(candidate => candidate.intact && candidate !== nucleus)
            .map(candidate => ({
                candidate,
                distance: Math.hypot(candidate.x - nucleus.x, candidate.y - nucleus.y)
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 3);

        for (let index = 0; index < 3; index += 1) {
            let dx;
            let dy;
            if (targets[index]) {
                dx = targets[index].candidate.x - nucleus.x;
                dy = targets[index].candidate.y - nucleus.y;
                const spread = (index - 1) * 0.2;
                const angle = Math.atan2(dy, dx) + spread;
                dx = Math.cos(angle);
                dy = Math.sin(angle);
            } else {
                const angle = (index - 1) * 0.85 + (Math.random() - 0.5) * 0.25;
                dx = Math.cos(angle);
                dy = Math.sin(angle);
            }
            addNeutron(nucleus.x, nucleus.y, dx, dy);
        }
    }

    function updateChain(delta) {
        const seconds = Math.min(delta / 1000, 0.04);

        for (let index = 0; index < chainNeutrons.length; index += 1) {
            const neutron = chainNeutrons[index];
            if (!neutron.active) continue;

            neutron.trail.unshift({ x: neutron.x, y: neutron.y });
            neutron.trail.length = 2;
            neutron.x += neutron.vx * seconds;
            neutron.y += neutron.vy * seconds;

            const hit = chainNuclei.find(nucleus => nucleus.intact &&
                Math.hypot(neutron.x - nucleus.x, neutron.y - nucleus.y) < nucleus.radius + 7);
            if (hit) splitNucleus(hit, neutron);

            if (neutron.x < -30 || neutron.x > width + 30 ||
                neutron.y < -30 || neutron.y > height + 30) {
                neutron.active = false;
            }
        }

        chainNeutrons = chainNeutrons.filter(neutron => neutron.active);
        if (chainNeutrons.length > 90) chainNeutrons.length = 90;

        if (chainNuclei.every(nucleus => !nucleus.intact)) {
            if (!chainRespawnAt) chainRespawnAt = performance.now() + 900;
            if (performance.now() >= chainRespawnAt) createChain();
        } else if (chainNeutrons.length === 0) {
            const target = chainNuclei.find(nucleus => nucleus.intact);
            if (target) {
                addNeutron(width * 0.06, target.y, 1, 0, true);
            }
        }

        const fissionedThisCycle = chainNuclei.filter(nucleus => !nucleus.intact).length;
        updateMetrics(accumulatedEnergy, totalFissions,
            Math.round((fissionedThisCycle / chainCapacity) * 100));
    }

    function animate(timestamp) {
        if (!isRunning) return;
        const delta = previousFrameTime ? Math.min(timestamp - previousFrameTime, 40) : 16.67;
        previousFrameTime = timestamp;

        if (currentMode === 'single') {
            singleElapsed += delta / 1000;
            if (singleElapsed >= singleDuration) {
                singleElapsed = singleDuration;
                drawScene(timestamp);
                isRunning = false;
                animationId = 0;
                stage.dataset.phase = 'complete';
                updateMetrics(200, 1, 100);
                updateStatus('Completed', 'bg-emerald-100 text-emerald-700 border-emerald-200');
                startBtn.innerHTML = '<i class="fa-solid fa-play"></i> Replay';
                return;
            }
            const progress = singleElapsed / singleDuration;
            if (progress < 1.8 / singleDuration) {
                updateMetrics(progress * 55, 0, Math.floor(progress * 30));
            } else if (progress < 3.4 / singleDuration) {
                updateMetrics(55 + ((progress - 1.8 / singleDuration) / (1.6 / singleDuration)) * 45, 0, 30 + Math.floor(progress * 30));
            } else {
                const fissionProgress = (progress - 3.4 / singleDuration) / (2.8 / singleDuration);
                updateMetrics(100 + fissionProgress * 100, 1, 60 + Math.floor(fissionProgress * 40));
            }
        } else {
            updateChain(delta);
        }

        drawScene(timestamp);
        animationId = requestAnimationFrame(animate);
    }

    function startSimulation() {
        if (isRunning) return;
        if (currentMode === 'single' && singleElapsed >= singleDuration) resetSimulation();

        isRunning = true;
        previousFrameTime = 0;
        stage.dataset.phase = currentMode === 'single' ? 'running' : 'chain';
        updateStatus('Running', 'bg-emerald-100 text-emerald-700 border-emerald-200');
        startBtn.innerHTML = '<i class="fa-solid fa-play"></i> Running';
        animationId = requestAnimationFrame(animate);
    }

    function setMode(mode) {
        currentMode = mode;
        singleModeBtn.classList.toggle('active', mode === 'single');
        chainModeBtn.classList.toggle('active', mode === 'chain');

        if (mode === 'single') {
            modeDescription.innerHTML = '<i class="fa-solid fa-desktop"></i> Mode: Single Uranium Fission';
            modeInfoText.innerHTML = '<b>Single Fission Mode:</b> Shows a neutron being absorbed by Uranium-235, forming unstable Uranium-236, then splitting into fragments and 3 neutrons.';
        } else {
            modeDescription.innerHTML = '<i class="fa-solid fa-desktop"></i> Mode: Fission Chain Reaction';
            modeInfoText.innerHTML = '<b>Fission Chain Reaction:</b> Released neutrons travel across the nuclei and trigger new fissions until the simulation is paused.';
        }
        resetSimulation();
    }

    startBtn.addEventListener('click', startSimulation);
    pauseBtn.addEventListener('click', () => {
        if (!isRunning) return;
        isRunning = false;
        cancelAnimationFrame(animationId);
        animationId = 0;
        previousFrameTime = 0;
        updateStatus('Paused', 'bg-amber-100 text-amber-700 border-amber-200');
        startBtn.innerHTML = '<i class="fa-solid fa-play"></i> Resume';
        drawScene();
    });
    singleModeBtn.addEventListener('click', () => setMode('single'));
    chainModeBtn.addEventListener('click', () => setMode('chain'));
    window.addEventListener('resize', resizeCanvas);

    resizeCanvas();
});
