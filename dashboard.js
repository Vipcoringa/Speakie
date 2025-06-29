function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

const getTokenFromQuery = () => {
    const urlParams = new URLSearchParams(window.location.search)
    return urlParams.get('token2')
}

const getTokenFromLocalStorage = () => {
    return localStorage.getItem('token2')
}

const getSpeakDataFromLocalStorage = () => {
    return localStorage.getItem('speakData')
}

const removeSpeakDataFromLocalStorage = () => {
    localStorage.removeItem('speakData')
}

const showModal = (message, onConfirm) => {
    const modalOverlay = document.querySelector('.modal-overlay');
    const modal = modalOverlay.querySelector('.modal');
    const messageEl = modal.querySelector('.modal-message');
    const confirmBtn = modal.querySelector('.modal-confirm');

    messageEl.textContent = message;
    modalOverlay.classList.add('active');

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener('click', () => {
        hideModal();
        if (onConfirm) onConfirm();
    });
}

const hideModal = () => {
    const modalOverlay = document.querySelector('.modal-overlay');
    modalOverlay.classList.remove('active');
}

function decodeCompressedResponse(encodedData) {
    try {
        const compressedData = atob(encodedData.replace(/-/g, '+').replace(/_/g, '/'));
        const compressedBytes = new Uint8Array(compressedData.length);
        for (let i = 0; i < compressedData.length; i++) {
            compressedBytes[i] = compressedData.charCodeAt(i);
        }
        const decompressed = pako.inflate(compressedBytes, {
            to: 'string'
        });
        return JSON.parse(decompressed);
    } catch (error) {
        console.error('Error decoding response:', error);
        throw error;
    }
}

(async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const compressedData = getSpeakDataFromLocalStorage() || urlParams.get('speakData');
    const timestamp = urlParams.get('timestamp');
    if (timestamp) console.log('Data fetched at:', decodeURIComponent(timestamp));

    if (!compressedData) {
        showModal(
            "No speak data found. Redirecting to home.",
            () => {
                window.location.href = '/';
            }
        );
        return;
    }

    const loader = document.createElement('div');
    loader.id = 'loader';
    loader.classList.add('spinner');
    loader.style.display = 'none';
    document.body.appendChild(loader);

    try {
        console.log('Decoding compressed data...');
        const jsonString = decodeCompressedResponse(compressedData);
        window.jsonData = jsonString;

        console.log('Decoded JSON:', jsonData);
        if (jsonData === null) {
            removeSpeakDataFromLocalStorage();
            showModal(
                "No speak data found. Redirecting to home.",
                () => {
                    window.location.href = '/';
                }
            );
            return;
        }

        const levels = jsonData.levelIds;
        const tokens = jsonData.tokens;
        const courseId = jsonData.courseId;

        const levelsContainer = document.getElementById('levelsContainer');

        const lessonsContainer = document.createElement('div');
        lessonsContainer.id = 'lessonsContainer';
        lessonsContainer.style.display = 'none';
        lessonsContainer.style.padding = '20px';
        lessonsContainer.style.textAlign = 'center';
        lessonsContainer.style.width = '95%';
        lessonsContainer.style.maxWidth = '800px';
        lessonsContainer.style.margin = '0 auto';
        document.body.appendChild(lessonsContainer);

        const backButton = document.createElement('button');
        backButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 8H1M1 8L8 15M1 8L8 1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Voltar';
        backButton.classList.add('back-button');
        backButton.addEventListener('click', () => {
            lessonsContainer.style.display = 'none';
            levelsContainer.style.display = 'grid';
            courseCompleterContainer.style.display = 'flex';
        });
        lessonsContainer.appendChild(backButton);

        const progressDisplay = document.createElement('div');
        progressDisplay.id = 'progressDisplay';
        progressDisplay.style.textAlign = 'center';
        progressDisplay.style.marginTop = '10px';
        progressDisplay.style.display = 'none';
        progressDisplay.style.color = '#333';
        progressDisplay.style.width = '100%';
        progressDisplay.style.padding = '0 10px';
        progressDisplay.style.boxSizing = 'border-box';
        document.body.appendChild(progressDisplay);

        const courseCompleterContainer = document.createElement('div');
        courseCompleterContainer.id = 'courseCompleterContainer';
        courseCompleterContainer.style.maxWidth = '800px';
        courseCompleterContainer.style.width = '95%';
        courseCompleterContainer.style.margin = '20px auto';
        courseCompleterContainer.style.padding = '0 10px';
        courseCompleterContainer.style.display = 'flex';
        courseCompleterContainer.style.flexDirection = 'column';
        courseCompleterContainer.style.alignItems = 'center';
        courseCompleterContainer.style.boxSizing = 'border-box';

        const courseCompleterHeading = document.createElement('h2');
        courseCompleterHeading.innerText = 'Concluir Todas Unidades';
        courseCompleterHeading.style.textAlign = 'center';
        courseCompleterHeading.style.margin = '0 0 10px 0';

        const courseCompleterButton = document.createElement('button');
        courseCompleterButton.innerText = 'Manutenção ⚒️';
        courseCompleterButton.classList.add('auto-answer-button');
        courseCompleterButton.style.marginLeft = '0';
        courseCompleterButton.addEventListener('click', async () => {
            showModal(
                "Em manutenção NÃO USE! Caso você cliquem em OK, Reinicie a Pagina Imediatamente.",
                async () => {
                    courseCompleterButton.disabled = true;
                    courseCompleterButton.innerText = 'Processamento...';
                    loader.style.display = 'block';
                    progressDisplay.style.display = 'block';

                    let totalLevels = levels.filter(level => !level.isLocked).length;
                    let completedLevels = 0;

                    for (const level of levels) {
                        if (level.isLocked || level.progress.status === "passed") {
                            completedLevels++;
                            continue;
                        }
                        let completed = false;
                        let prevLessonId = null;
                        while (!completed) {
                            let lessons = await getLessons(level.id);
                            if (prevLessonId === lessons[0].id) {
                                if (lessons.every(lesson => lesson.progress.status === "passed")) {
                                    completed = true;
                                    completedLevels++;
                                    progressDisplay.innerText = `Completou ${completedLevels} de ${totalLevels} níveis`;
                                    break;
                                }
                            }
                            prevLessonId = lessons[0].id;
                            await sendLessonRequest(lessons, true);
                            await sleep(3500);
                        }
                    }
                    courseCompleterButton.innerText = 'Curso Completado';
                    loader.style.display = 'none';
                    progressDisplay.style.display = 'none';
                    courseCompleterButton.disabled = false;
                }
            );
        });

        courseCompleterContainer.appendChild(courseCompleterHeading);
        courseCompleterContainer.appendChild(courseCompleterButton);
        document.body.appendChild(courseCompleterContainer);

        function createLevelButtons(levels) {
            levelsContainer.innerHTML = '';
            if (!levels) return alert("err1");
            levels.forEach((level) => {
                const button = document.createElement('button');
                button.textContent = `Level ${level.sequenceNumber}`;

                if (level.isLocked) {
                    button.classList.add('locked');
                }

                const levelNumber = document.createElement('div');
                levelNumber.classList.add('level-number');
                levelNumber.textContent = `#${level.sequenceNumber}`;
                button.appendChild(levelNumber);

                const levelTitle = document.createElement('div');
                levelTitle.classList.add('level-title');
                levelTitle.textContent = level.title;
                button.appendChild(levelTitle);

                button.addEventListener('click', async () => {
                    console.log('Clicked level:', level.id);
                    loader.style.display = 'block';
                    levelsContainer.style.display = 'none';
                    courseCompleterContainer.style.display = 'none';
                    const lessons = await getLessons(level.id);
                    window.lessonData = lessons;
                    displayLessons(lessons);
                });

                levelsContainer.appendChild(button);
            });
            loader.style.display = 'none';
            console.log('Levels rendered:', levels.length);
        }

        async function getLessons(levelId) {
            const token = getTokenFromLocalStorage();
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Origin': window.location.origin,
                'Referer': window.location.href,
                'cf-chl-opt': JSON.stringify({ cFPWv: 'g' })
            };
            const response = await fetch('https://speakify.cupiditys.lol/api/lessons', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    tokens: jsonData.tokens,
                    levelId: levelId,
                    courseId: jsonData.courseId
                }),
                timeout: 30000
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error:', response.status, response.statusText, errorText);
                alert(`Falha ao descarregar as lições da API (Status: ${response.status}). Verifique o console para detalhes. Se persistir, peça ajuda no Discord.`);
                throw new Error(`HTTP error! status: ${response.status}, ${errorText}`);
            }
            return await response.json();
        }

        async function sendLessonRequest(data, isBulk = false) {
            const token = getTokenFromLocalStorage();
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Origin': window.location.origin,
                'Referer': window.location.href,
                'cf-chl-opt': JSON.stringify({ cFPWv: 'g' })
            };
            try {
                if (!isBulk) {
                    const response = await fetch('https://speakify.cupiditys.lol/api/lessons', {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify({
                            tokens: jsonData.tokens,
                            levelId: data,
                            courseId: jsonData.courseId
                        }),
                        timeout: 30000
                    });
                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('API Error:', response.status, response.statusText, errorText);
                        alert(`Falha ao descarregar as lições da API (Status: ${response.status}). Verifique o console para detalhes. Se persistir, peça ajuda no Discord.`);
                        throw new Error(`HTTP error! status: ${response.status}, ${errorText}`);
                    }
                    data = await response.json();
                }
                window.lessonData = data;
                console.log('Lesson data received:', lessonData);

                if (isBulk) {
                    let totalLessons = window.lessonData.length;
                    let completedLessons = 0;
                    for (const lesson of window.lessonData) {
                        if (lesson.progress.status === "passed") {
                            completedLessons++;
                            continue;
                        }
                        const nodeId = lesson.id;
                        const token = jsonData.tokens.account;
                        const lessonNumber = lesson.sequenceNumber;
                        const type = lesson.type;
                        await handleAutoAnswer(nodeId, token, lessonNumber, null, type);
                        completedLessons++;
                        progressDisplay.innerText = `Concluiu a lição ${completedLessons} de ${totalLessons} no nível atual`;
                        await sleep(750);
                    }
                } else {
                    displayLessons(lessonData);
                }
            } catch (error) {
                console.error('Error fetching lessons:', error);
                if (!isBulk) {
                    lessonsContainer.innerHTML = '<p>Falha ao carregar lições.</p>';
                }
            } finally {
                loader.style.display = 'none';
                if (!isBulk) {
                    lessonsContainer.style.display = 'block';
                } else {
                    levelsContainer.style.display = 'grid';
                    courseCompleterContainer.style.display = 'flex';
                }
            }
        }

        async function handleAutoAnswer(nodeId, token, lessonNumber, buttonElement, type) {
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Origin': window.location.origin,
                'Referer': window.location.href,
                'cf-chl-opt': JSON.stringify({ cFPWv: 'g' })
            };
            try {
                const response = await fetch('https://speakify.cupiditys.lol/api/auto-answer', {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        nodeId,
                        token,
                        courseId: jsonData.courseId,
                        type
                    }),
                    timeout: 30000
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('API Error:', response.status, response.statusText, errorText);
                    throw new Error(`Auto Answer failed with status: ${response.status}, ${errorText}`);
                }

                const result = await response.json();
                console.log(`Auto Answer successful for Lesson ${lessonNumber}:`, result);

                if (buttonElement) {
                    buttonElement.innerText = 'Concluida';
                }

            } catch (error) {
                console.error('Error in Auto Answer:', error);
                alert(`Falha ao responder a lição ${lessonNumber}. Verifique o console para detalhes.`);

                if (buttonElement) {
                    buttonElement.innerText = 'Responder automaticamente';
                    buttonElement.disabled = false;
                }
            }
        }

        const completeAllLessonsButton = document.createElement('button');
        completeAllLessonsButton.innerText = 'Concluir todas as lições';
        completeAllLessonsButton.classList.add('complete-all-lessons-button');
        completeAllLessonsButton.addEventListener('click', async () => {
            if (window.lessonData && window.lessonData.length > 0) {
                showModal(
                    `Isso tentará concluir todas as ${window.lessonData.length} lições deste nível. Tem certeza de que deseja continuar?`,
                    async () => {
                        completeAllLessonsButton.disabled = true;
                        completeAllLessonsButton.innerText = 'Processando...';
                        loader.style.display = 'block';
                        progressDisplay.style.display = 'block';

                        let totalLessons = window.lessonData.length;
                        let completedLessons = 0;
                        for (const lesson of window.lessonData) {
                            if (lesson.progress.status === "passed") {
                                completedLessons++;
                                continue;
                            }
                            const nodeId = lesson.id;
                            const token = jsonData.tokens.account;
                            const lessonNumber = lesson.sequenceNumber;
                            const type = lesson.type;
                            if (type === "level_test" || lesson.progress.status === "passed") continue;
                            await handleAutoAnswer(nodeId, token, lessonNumber, document.getElementById(`lesson-${nodeId}`), type);
                            completedLessons++;
                            progressDisplay.innerText = `Concluiu a lição ${completedLessons} de ${totalLessons}`;
                            await sleep(750);
                        }
                        completeAllLessonsButton.innerText = 'Todas as lições concluídas';
                        loader.style.display = 'none';
                        progressDisplay.style.display = 'none';
                        completeAllLessonsButton.disabled = false;
                    }
                );
            }
        });
        lessonsContainer.appendChild(completeAllLessonsButton);

        function displayLessons(lessons) {
            lessonsContainer.innerHTML = '';

            lessonsContainer.appendChild(backButton);
            completeAllLessonsButton.innerText = 'Concluir todas as lições';
            lessonsContainer.appendChild(completeAllLessonsButton);

            courseCompleterContainer.style.display = 'none';

            const lessonsBoxContainer = document.createElement('div');
            lessonsBoxContainer.classList.add('lessons-box-container');
            lessonsContainer.appendChild(lessonsBoxContainer);
            if (!lessons) return alert("err2");
            lessons.forEach((lesson) => {
                const lessonBox = document.createElement('div');
                lessonBox.classList.add('lesson-box');

                const lessonIndex = document.createElement('h3');
                lessonIndex.innerText = `Lição ${lesson.sequenceNumber}`;
                lessonBox.appendChild(lessonIndex);

                const lessonTitle = document.createElement('p');
                lessonTitle.innerText = lesson.title;
                lessonTitle.style.wordBreak = 'break-word';
                lessonTitle.style.width = '100%';
                lessonTitle.style.textAlign = 'center';
                lessonBox.appendChild(lessonTitle);

                const autoAnswerButton = document.createElement('button');
                autoAnswerButton.classList.add('auto-answer-button');
                autoAnswerButton.id = `lesson-${lesson.id}`;
                if (lesson.progress.status === "passed") {
                    autoAnswerButton.innerText = 'Conluida';
                } else {
                    autoAnswerButton.innerText = 'Responder automaticamente';
                }

                autoAnswerButton.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const nodeId = lesson.id;
                    const token = jsonData.tokens.account;
                    const lessonNumber = lesson.sequenceNumber;
                    const type = lesson.type;
                    await handleAutoAnswer(nodeId, token, lessonNumber, autoAnswerButton, type);
                });

                lessonBox.appendChild(autoAnswerButton);

                lessonsBoxContainer.appendChild(lessonBox);
            });

            lessonsContainer.style.display = 'block';
        }

        createLevelButtons(levels);

        document.querySelector('.modal-cancel').addEventListener('click', hideModal);
        document.querySelector('.modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) hideModal();
        });

        function checkMobile() {
            if (window.innerWidth <= 768) {
                document.querySelectorAll('.auto-answer-button').forEach(btn => {
                    if (btn.innerText === 'Responder automaticamente') {
                        btn.innerText = 'Responder';
                    }
                });
            }
        }

        checkMobile();
        window.addEventListener('resize', checkMobile);

        removeSpeakDataFromLocalStorage();

        showModal(
            "Obrigado por usar o MoonSpeak.",
            () => {}
        );

    } catch (error) {
        console.error('Error in main execution:', error);
        alert('Error: ' + error);
        showModal(
            "Ocorreu um erro ao carregar o Speakify. Por favor, tente novamente mais tarde. Se o problema persistir, peça ajuda no Discord."
        );
        removeSpeakDataFromLocalStorage();
    } finally {
        loader.style.display = 'none';
    }
})();