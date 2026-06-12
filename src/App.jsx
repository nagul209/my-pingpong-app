import { useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentUser, membersRef, matchesRef, pushValue, removeValue, setValue } from './firebase';

function getFirebaseErrorMessage(error) {
    if (error?.code === 'PERMISSION_DENIED' || error?.message?.includes('PERMISSION_DENIED')) {
        return '데이터베이스 권한이 없습니다. 관리자에게 Realtime Database 규칙 배포 여부를 확인해주세요.';
    }
    if (error?.code === 'auth/admin-restricted-operation' || error?.code === 'auth/operation-not-allowed') {
        return 'Firebase 익명 로그인이 꺼져 있습니다. Firebase Authentication에서 익명 로그인을 활성화해주세요.';
    }
    return error?.message || '잠시 후 다시 시도해주세요.';
}

const PLAYER_NAME_MAX_LENGTH = 30;
const MATCH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MATCH_SCORE_OPTIONS = [
    { scoreA: 3, scoreB: 0 },
    { scoreA: 3, scoreB: 1 },
    { scoreA: 3, scoreB: 2 },
    { scoreA: 0, scoreB: 3 },
    { scoreA: 1, scoreB: 3 },
    { scoreA: 2, scoreB: 3 }
];

function isAllowedMatchScore(scoreA, scoreB) {
    return MATCH_SCORE_OPTIONS.some(option => option.scoreA === scoreA && option.scoreB === scoreB);
}

function validateMatchPayload({ date, playerAId, playerAName, playerBId, playerBName, scoreA, scoreB }) {
    if (!MATCH_DATE_PATTERN.test(date || '')) return '경기 날짜는 YYYY-MM-DD 형식이어야 합니다.';
    if (!playerAId || !playerBId) return '두 선수를 모두 선택해주세요.';
    if (playerAId === playerBId) return '서로 다른 선수를 선택해주세요.';
    if (!isAllowedMatchScore(scoreA, scoreB)) return '허용된 세트 스코어(3:0, 3:1, 3:2, 0:3, 1:3, 2:3)만 저장할 수 있습니다.';
    if (typeof playerAName !== 'string' || playerAName.trim().length === 0 || playerAName.length > PLAYER_NAME_MAX_LENGTH) return `선수 A 이름은 1~${PLAYER_NAME_MAX_LENGTH}자여야 합니다.`;
    if (typeof playerBName !== 'string' || playerBName.trim().length === 0 || playerBName.length > PLAYER_NAME_MAX_LENGTH) return `선수 B 이름은 1~${PLAYER_NAME_MAX_LENGTH}자여야 합니다.`;
    return '';
}

// -------------------------------------------------------------
// 2. React 메인 앱 컴포넌트
// -------------------------------------------------------------
function App() {
    const [activeTab, setActiveTab] = useState('match');
    const [members, setMembers] = useState([]);
    const [matches, setMatches] = useState([]);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [authError, setAuthError] = useState('');

    // Firebase 익명 로그인 후 실시간 데이터 구독
    useEffect(() => {
        let membersRefUnsubscribe;
        let matchesRefUnsubscribe;

        getCurrentUser()
            .then(() => {
                setIsAuthReady(true);

                membersRefUnsubscribe = membersRef.onValue(snapshot => {
                    const data = snapshot.val();
                    const formatted = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
                    setMembers(formatted);
                }, error => {
                    console.error('회원 목록 불러오기 실패:', error);
                    setAuthError(getFirebaseErrorMessage(error));
                });

                matchesRefUnsubscribe = matchesRef.onValue(snapshot => {
                    const data = snapshot.val();
                    const formatted = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
                    // 최신순 정렬
                    setMatches(formatted.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)));
                }, error => {
                    console.error('경기 기록 불러오기 실패:', error);
                    setAuthError(getFirebaseErrorMessage(error));
                });
            })
            .catch(error => {
                console.error('Firebase 로그인 실패:', error);
                setAuthError(getFirebaseErrorMessage(error));
            });

        return () => {
            if (membersRefUnsubscribe) membersRefUnsubscribe();
            if (matchesRefUnsubscribe) matchesRefUnsubscribe();
        };
    }, []);

    return (
        <div className="flex flex-col h-screen">
            <header className="bg-blue-600 text-white p-4 text-center font-black text-lg shadow-sm">
                🏓 탁구 기록기
            </header>

            <main className="flex-1 overflow-y-auto p-4">
                {authError && (
                    <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">
                        {authError}
                    </div>
                )}
                {!isAuthReady && !authError && (
                    <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm font-bold text-blue-700">
                        Firebase에 연결하는 중입니다...
                    </div>
                )}
                {activeTab === 'member' && <MemberTab members={members} isAuthReady={isAuthReady} />}
                {activeTab === 'match' && <MatchTab members={members} isAuthReady={isAuthReady} />}
                {activeTab === 'stats' && <StatsTab members={members} matches={matches} isAuthReady={isAuthReady} />}
            </main>

            {/* 하단 네비게이션 */}
            <nav className="bg-white border-t flex justify-around p-3 fixed bottom-0 w-full max-w-md text-sm font-bold text-gray-400 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <button onClick={() => setActiveTab('member')} className={`flex-1 flex flex-col items-center btn-press ${activeTab === 'member' ? 'text-blue-600' : ''}`}>
                    <span className="text-xl mb-1">👥</span>회원
                </button>
                <button onClick={() => setActiveTab('match')} className={`flex-1 flex flex-col items-center btn-press ${activeTab === 'match' ? 'text-blue-600' : ''}`}>
                    <span className="text-xl mb-1">⚔️</span>경기
                </button>
                <button onClick={() => setActiveTab('stats')} className={`flex-1 flex flex-col items-center btn-press ${activeTab === 'stats' ? 'text-blue-600' : ''}`}>
                    <span className="text-xl mb-1">📊</span>통계
                </button>
            </nav>
        </div>
    );
}


function PlayerCardSelector({ members, selectedA, selectedB, activeSlot, onActiveSlotChange, onSelect, labels = { a: '선수 A', b: '선수 B' } }) {
    const getName = (id, fallback) => members.find(m => m.id === id)?.name || fallback;

    return (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                <button
                    type="button"
                    onClick={() => onActiveSlotChange('A')}
                    className={`min-w-0 p-3 rounded-xl text-center border-2 btn-press ${activeSlot === 'A' ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-blue-50 border-blue-100 text-blue-800'}`}
                >
                    <div className="text-[10px] font-black opacity-70 mb-1">{labels.a}</div>
                    <div className="font-black text-lg truncate">{getName(selectedA, '선택')}</div>
                </button>
                <span className="font-black text-gray-300 italic text-xl">VS</span>
                <button
                    type="button"
                    onClick={() => onActiveSlotChange('B')}
                    className={`min-w-0 p-3 rounded-xl text-center border-2 btn-press ${activeSlot === 'B' ? 'bg-red-600 border-red-600 text-white shadow-md' : 'bg-red-50 border-red-100 text-red-800'}`}
                >
                    <div className="text-[10px] font-black opacity-70 mb-1">{labels.b}</div>
                    <div className="font-black text-lg truncate">{getName(selectedB, '선택')}</div>
                </button>
            </div>

            <div>
                <p className="text-xs font-bold text-gray-400 mb-2 text-center">
                    {activeSlot === 'A' ? `${labels.a}를 선택하세요. 선택 후 바로 ${labels.b}를 고를 수 있습니다.` : `${labels.b}를 선택하세요.`}
                </p>
                {members.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                        {members.map(member => {
                            const isSelectedA = selectedA === member.id;
                            const isSelectedB = selectedB === member.id;
                            const isSelected = isSelectedA || isSelectedB;
                            return (
                                <button
                                    key={member.id}
                                    type="button"
                                    onClick={() => onSelect(member.id)}
                                    className={`min-w-0 text-left p-3 rounded-xl border-2 shadow-sm btn-press transition ${isSelected ? 'bg-gray-900 border-gray-900 text-white' : activeSlot === 'A' ? 'bg-white border-blue-100 text-gray-800 hover:bg-blue-50' : 'bg-white border-red-100 text-gray-800 hover:bg-red-50'}`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-black text-base truncate">{member.name}</span>
                                        <span className={`shrink-0 text-[10px] font-black px-2 py-1 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                            {isSelectedA ? labels.a : isSelectedB ? labels.b : member.division || '부수'}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center text-sm font-bold text-gray-400 py-4 bg-gray-50 rounded-xl">등록된 회원이 없습니다.</div>
                )}
            </div>
        </div>
    );
}

// -------------------------------------------------------------
// 3. 회원 관리 탭 컴포넌트
// -------------------------------------------------------------
function MemberTab({ members, isAuthReady }) {
    const DIVISION_OPTIONS = ['1부', '2부', '3부', '4부', '5부', '6부', '7부'];
    const [name, setName] = useState('');
    const [division, setDivision] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const addMember = async () => {
        const trimmedName = name.trim();

        if (!isAuthReady) return alert('Firebase 연결이 완료된 후 다시 시도해주세요.');
        if (!trimmedName) return alert("이름을 입력해주세요.");
        if (!division) return alert("부수를 선택해주세요.");

        setIsSaving(true);

        try {
            const newMember = {
                name: trimmedName,
                division,
                joinedAt: Date.now()
            };
            const currentUser = await getCurrentUser();
            if (currentUser?.uid) newMember.createdBy = currentUser.uid;

            await pushValue(membersRef.ref, newMember);
            setName('');
            setDivision('');
            alert("회원이 추가되었습니다.");
        } catch (error) {
            console.error('회원 저장 실패:', error);
            alert(`회원 저장에 실패했습니다.\n${getFirebaseErrorMessage(error)}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="font-extrabold text-gray-800 mb-4 text-lg">➕ 새 회원 등록</h2>
                <div className="space-y-3">
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="이름" className="w-full bg-gray-50 border-0 p-3 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                    <select value={division} onChange={e => setDivision(e.target.value)} className="w-full bg-gray-50 border-0 p-3 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none">
                        <option value="" disabled>부수를 선택하세요</option>
                        {DIVISION_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                    <button onClick={addMember} disabled={isSaving || !isAuthReady} className={`w-full font-bold p-3 rounded-xl shadow-md btn-press ${isSaving || !isAuthReady ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-blue-600 text-white'}`}>
                        {isSaving ? '저장 중...' : isAuthReady ? '등록하기' : '연결 중...'}
                    </button>
                </div>
            </div>

            <div>
                <h2 className="font-extrabold text-gray-800 mb-3 text-lg px-1">📋 회원 목록 ({members.length}명)</h2>
                <ul className="space-y-2">
                    {members.map(m => (
                        <li key={m.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                            <span className="font-bold text-gray-800 text-lg">{m.name}</span>
                            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                                {m.division || '부수 미입력'}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

// -------------------------------------------------------------
// 4. 경기 기록 탭 컴포넌트 (원터치 최적화)
// -------------------------------------------------------------
function MatchTab({ members, isAuthReady }) {
    const today = new Date().toISOString().split('T')[0];
    const [date, setDate] = useState(today);
    const [playerA, setPlayerA] = useState('');
    const [playerB, setPlayerB] = useState('');
    const [activePlayerSlot, setActivePlayerSlot] = useState('A');
    const [isSavingMatch, setIsSavingMatch] = useState(false);
    const isSavingMatchRef = useRef(false);
    const recentSavedMatchRef = useRef({ key: '', savedAt: 0 });
    const duplicateGuardMs = 3000;
    const scoreButtonDisabledClass = 'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:active:transform-none disabled:shadow-none';
    const scoreButtons = MATCH_SCORE_OPTIONS.map(option => ({
        ...option,
        color: option.scoreA > option.scoreB ? 'blue' : 'red'
    }));

    const selectMatchPlayer = (memberId) => {
        if (activePlayerSlot === 'A') {
            setPlayerA(memberId);
            if (memberId === playerB) setPlayerB('');
            setActivePlayerSlot('B');
            return;
        }

        if (memberId === playerA) {
            alert('서로 다른 선수를 선택해주세요.');
            return;
        }

        setPlayerB(memberId);
    };

    const saveMatch = async (scoreA, scoreB) => {
        if (isSavingMatch || isSavingMatchRef.current) return;
        if (!isAuthReady) return alert('Firebase 연결이 완료된 후 다시 시도해주세요.');

        const nameA = members.find(m => m.id === playerA)?.name;
        const nameB = members.find(m => m.id === playerB)?.name;
        const validationMessage = validateMatchPayload({
            date,
            playerAId: playerA,
            playerAName: nameA,
            playerBId: playerB,
            playerBName: nameB,
            scoreA,
            scoreB
        });
        if (validationMessage) return alert(validationMessage);

        const matchKey = [date, playerA, playerB, scoreA, scoreB].join('|');
        const now = Date.now();
        if (recentSavedMatchRef.current.key === matchKey && now - recentSavedMatchRef.current.savedAt < duplicateGuardMs) {
            return alert('방금 저장한 동일 경기입니다. 잠시 후 다시 시도해주세요.');
        }

        setIsSavingMatch(true);
        isSavingMatchRef.current = true;

        try {
            const newMatch = {
                date,
                playerA_id: playerA, playerA_name: nameA,
                playerB_id: playerB, playerB_name: nameB,
                scoreA, scoreB,
                timestamp: Date.now()
            };
            const currentUser = await getCurrentUser();
            if (currentUser?.uid) newMatch.createdBy = currentUser.uid;

            await pushValue(matchesRef.ref, newMatch);

            recentSavedMatchRef.current = { key: matchKey, savedAt: Date.now() };
            alert(`${nameA} ${scoreA} : ${scoreB} ${nameB}\n기록이 저장되었습니다!`);
        } catch (error) {
            console.error('경기 저장 실패:', error);
            alert(`경기 저장에 실패했습니다.\n${getFirebaseErrorMessage(error)}`);
        } finally {
            isSavingMatchRef.current = false;
            setIsSavingMatch(false);
        }
        // 초기화 (다음 경기를 위해 선수는 유지하고 스코어만 리셋하는 개념이므로 알림만 띄움)
    };

    return (
        <div className="flex flex-col gap-5 h-full">
            {/* 날짜 */}
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-white border border-gray-200 text-center font-bold text-gray-700 p-3 rounded-xl shadow-sm outline-none" />

            {/* 선수 선택 */}
            <PlayerCardSelector
                members={members}
                selectedA={playerA}
                selectedB={playerB}
                activeSlot={activePlayerSlot}
                onActiveSlotChange={setActivePlayerSlot}
                onSelect={selectMatchPlayer}
            />

            {/* 원터치 스코어 보드 */}
            <div className="mt-4">
                <p className="text-center text-xs font-bold text-gray-400 mb-3">👇 경기 결과를 터치하면 즉시 저장됩니다</p>
                <div className="grid grid-cols-2 gap-3">
                    {scoreButtons.map(({ scoreA, scoreB, color }) => {
                        const colorClass = color === 'blue'
                            ? 'border-blue-100 hover:bg-blue-50 text-blue-700'
                            : 'border-red-100 hover:bg-red-50 text-red-700';

                        return (
                            <button
                                key={`${scoreA}-${scoreB}`}
                                onClick={() => saveMatch(scoreA, scoreB)}
                                disabled={isSavingMatch || !isAuthReady}
                                className={`bg-white border-2 ${colorClass} font-black text-2xl py-6 rounded-2xl shadow-sm btn-press ${scoreButtonDisabledClass}`}
                            >
                                {scoreA} : {scoreB} 승리
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// -------------------------------------------------------------
// 5. 통계 탭 컴포넌트
// -------------------------------------------------------------
function StatsTab({ members, matches, isAuthReady }) {
    const [personalPlayer, setPersonalPlayer] = useState('');
    const [statA, setStatA] = useState('');
    const [statB, setStatB] = useState('');
    const [activeStatSlot, setActiveStatSlot] = useState('A');
    const [editingMatchId, setEditingMatchId] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editPlayerA, setEditPlayerA] = useState('');
    const [editPlayerB, setEditPlayerB] = useState('');
    const [editScoreA, setEditScoreA] = useState(3);
    const [editScoreB, setEditScoreB] = useState(0);
    const [savingMatchId, setSavingMatchId] = useState('');

    const getPlayerName = (playerId) => members.find(member => member.id === playerId)?.name || '선수';

    const getOpponentInfo = (opponentId, fallbackName) => {
        const member = members.find(item => item.id === opponentId);
        return {
            id: opponentId,
            name: member?.name || fallbackName || '알 수 없음',
            division: member?.division || '부수 미입력'
        };
    };

    const SCORE_OPTIONS = MATCH_SCORE_OPTIONS;

    const getMemberName = (memberId, fallbackName) => members.find(member => member.id === memberId)?.name || fallbackName || '선수';

    const getPlayerOptions = (currentId, currentName) => {
        const hasCurrentMember = members.some(member => member.id === currentId);
        return hasCurrentMember || !currentId
            ? members
            : [{ id: currentId, name: currentName || '삭제된 회원', division: '기존 기록' }, ...members];
    };

    const startEditMatch = (match) => {
        setEditingMatchId(match.id);
        setEditDate(match.date || new Date().toISOString().split('T')[0]);
        setEditPlayerA(match.playerA_id || '');
        setEditPlayerB(match.playerB_id || '');
        setEditScoreA(Number(match.scoreA));
        setEditScoreB(Number(match.scoreB));
    };

    const cancelEditMatch = () => {
        setEditingMatchId('');
        setSavingMatchId('');
    };

    const updateMatch = async (match) => {
        if (!isAuthReady) return alert('Firebase 연결이 완료된 후 다시 시도해주세요.');

        const nameA = getMemberName(editPlayerA, match.playerA_id === editPlayerA ? match.playerA_name : '선수 A');
        const nameB = getMemberName(editPlayerB, match.playerB_id === editPlayerB ? match.playerB_name : '선수 B');
        const validationMessage = validateMatchPayload({
            date: editDate,
            playerAId: editPlayerA,
            playerAName: nameA,
            playerBId: editPlayerB,
            playerBName: nameB,
            scoreA: editScoreA,
            scoreB: editScoreB
        });
        if (validationMessage) return alert(validationMessage);

        setSavingMatchId(match.id);

        try {
            const updatedMatch = {
                date: editDate,
                playerA_id: editPlayerA,
                playerA_name: nameA,
                playerB_id: editPlayerB,
                playerB_name: nameB,
                scoreA: editScoreA,
                scoreB: editScoreB,
                timestamp: match.timestamp || Date.now(),
                updatedAt: Date.now()
            };
            if (match.createdBy) updatedMatch.createdBy = match.createdBy;
            const currentUser = await getCurrentUser();
            if (currentUser?.uid) updatedMatch.updatedBy = currentUser.uid;

            await setValue(`simple_matches/${match.id}`, updatedMatch);
            cancelEditMatch();
            alert('경기 기록이 수정되었습니다.');
        } catch (error) {
            console.error('경기 수정 실패:', error);
            alert(`경기 수정에 실패했습니다.\n${getFirebaseErrorMessage(error)}`);
        } finally {
            setSavingMatchId('');
        }
    };

    const deleteMatch = async (match) => {
        if (!isAuthReady) return alert('Firebase 연결이 완료된 후 다시 시도해주세요.');

        const ok = confirm(`${match.date} ${match.playerA_name} ${match.scoreA} : ${match.scoreB} ${match.playerB_name}\n이 경기 기록을 삭제할까요?`);
        if (!ok) return;

        setSavingMatchId(match.id);

        try {
            await removeValue(`simple_matches/${match.id}`);
            if (editingMatchId === match.id) cancelEditMatch();
            alert('경기 기록이 삭제되었습니다.');
        } catch (error) {
            console.error('경기 삭제 실패:', error);
            alert(`경기 삭제에 실패했습니다.\n${getFirebaseErrorMessage(error)}`);
        } finally {
            setSavingMatchId('');
        }
    };

    const selectStatPlayer = (memberId) => {
        if (activeStatSlot === 'A') {
            setStatA(memberId);
            if (memberId === statB) setStatB('');
            setActiveStatSlot('B');
            return;
        }

        if (memberId === statA) {
            alert('서로 다른 선수를 선택해주세요.');
            return;
        }

        setStatB(memberId);
    };

    // 개인 전적 계산: 선택 선수의 전체 경기와 상대별 기록을 집계
    const personalStats = useMemo(() => {
        if (!personalPlayer) return null;

        const playerMatches = matches.filter(match =>
            match.playerA_id === personalPlayer || match.playerB_id === personalPlayer
        );

        const opponentMap = {};
        let wins = 0;
        let losses = 0;

        playerMatches.forEach(match => {
            const isPlayerA = match.playerA_id === personalPlayer;
            const playerScore = isPlayerA ? match.scoreA : match.scoreB;
            const opponentScore = isPlayerA ? match.scoreB : match.scoreA;
            const opponentId = isPlayerA ? match.playerB_id : match.playerA_id;
            const opponentName = isPlayerA ? match.playerB_name : match.playerA_name;
            const didWin = playerScore > opponentScore;

            if (didWin) wins++; else losses++;

            if (!opponentMap[opponentId]) {
                opponentMap[opponentId] = {
                    ...getOpponentInfo(opponentId, opponentName),
                    wins: 0,
                    losses: 0,
                    total: 0
                };
            }

            opponentMap[opponentId].total++;
            if (didWin) opponentMap[opponentId].wins++; else opponentMap[opponentId].losses++;
        });

        const opponents = Object.values(opponentMap)
            .map(opponent => ({
                ...opponent,
                winRate: opponent.total ? Math.round((opponent.wins / opponent.total) * 100) : 0
            }))
            .sort((a, b) => b.total - a.total || b.wins - a.wins || a.name.localeCompare(b.name, 'ko'));

        const total = wins + losses;
        return {
            total,
            wins,
            losses,
            winRate: total ? Math.round((wins / total) * 100) : 0,
            opponents
        };
    }, [personalPlayer, matches, members]);

    // 상대 전적에 해당하는 경기만 추려 최신순으로 표시
    const h2hMatches = useMemo(() => {
        if (!statA || !statB) return [];
        return matches.filter(m =>
            (m.playerA_id === statA && m.playerB_id === statB) ||
            (m.playerA_id === statB && m.playerB_id === statA)
        );
    }, [statA, statB, matches]);

    // 상대 전적 계산
    const h2hStats = useMemo(() => {
        if (!statA || !statB) return null;
        let aWins = 0, bWins = 0;
        h2hMatches.forEach(m => {
            if (m.playerA_id === statA && m.playerB_id === statB) {
                if (m.scoreA > m.scoreB) aWins++; else bWins++;
            } else if (m.playerA_id === statB && m.playerB_id === statA) {
                if (m.scoreB > m.scoreA) aWins++; else bWins++;
            }
        });
        return { aWins, bWins, total: aWins + bWins };
    }, [statA, statB, h2hMatches]);

    return (
        <div className="space-y-6">
            {/* 개인 전적 검색 */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="font-extrabold text-gray-800 mb-2 text-lg">👤 개인 전적 기록</h2>
                <p className="text-xs font-bold text-gray-400 mb-3">조사할 선수 카드를 선택하면 전체 승률과 상대별 기록이 표시됩니다.</p>

                {members.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        {members.map(member => {
                            const isSelected = personalPlayer === member.id;
                            return (
                                <button
                                    key={member.id}
                                    type="button"
                                    onClick={() => setPersonalPlayer(member.id)}
                                    className={`min-w-0 text-left p-3 rounded-xl border-2 shadow-sm btn-press transition ${isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-emerald-100 text-gray-800 hover:bg-emerald-50'}`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-black text-base truncate">{member.name}</span>
                                        <span className={`shrink-0 text-[10px] font-black px-2 py-1 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'}`}>
                                            {member.division || '부수'}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center text-sm font-bold text-gray-400 py-4 bg-gray-50 rounded-xl">등록된 회원이 없습니다.</div>
                )}

                {personalPlayer && personalStats ? (
                    <div className="space-y-4">
                        <div className="bg-emerald-600 text-white p-4 rounded-xl">
                            <div className="text-sm font-bold text-emerald-100 mb-3">{getPlayerName(personalPlayer)} 개인 통계</div>
                            <div className="grid grid-cols-4 gap-2 text-center">
                                <div>
                                    <div className="text-2xl font-black">{personalStats.total}</div>
                                    <div className="text-[10px] font-bold text-emerald-100">경기</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-black">{personalStats.wins}</div>
                                    <div className="text-[10px] font-bold text-emerald-100">승</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-black">{personalStats.losses}</div>
                                    <div className="text-[10px] font-bold text-emerald-100">패</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-black">{personalStats.winRate}%</div>
                                    <div className="text-[10px] font-bold text-emerald-100">승률</div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="font-extrabold text-gray-700 mb-2 text-sm">상대별 기록</h3>
                            {personalStats.opponents.length > 0 ? (
                                <ul className="space-y-2">
                                    {personalStats.opponents.map(opponent => (
                                        <li key={opponent.id} className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                <div className="min-w-0">
                                                    <div className="font-black text-gray-800 truncate">vs {opponent.name}</div>
                                                    <div className="text-[10px] font-bold text-gray-400">{opponent.division}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-black text-emerald-600">{opponent.wins}승 {opponent.losses}패</div>
                                                    <div className="text-[10px] font-bold text-gray-400">총 {opponent.total}전 · 승률 {opponent.winRate}%</div>
                                                </div>
                                            </div>
                                            <div className="h-2 bg-white rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${opponent.winRate}%` }}></div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-center text-sm font-bold text-gray-400 py-4 bg-gray-50 rounded-xl">이 선수의 경기 기록이 없습니다.</div>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>

            {/* 상대 전적 검색 */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="font-extrabold text-gray-800 mb-4 text-lg">⚔️ 상대 전적 비교</h2>
                <div className="mb-4">
                    <PlayerCardSelector
                        members={members}
                        selectedA={statA}
                        selectedB={statB}
                        activeSlot={activeStatSlot}
                        onActiveSlotChange={setActiveStatSlot}
                        onSelect={selectStatPlayer}
                        labels={{ a: '비교 A', b: '비교 B' }}
                    />
                </div>

                {h2hStats && h2hStats.total > 0 ? (
                    <div className="flex justify-between items-center bg-gray-800 text-white p-4 rounded-xl">
                        <div className="text-center w-1/3">
                            <div className="text-2xl font-black text-blue-400">{h2hStats.aWins}승</div>
                        </div>
                        <div className="text-center w-1/3 text-xs font-medium text-gray-400">총 {h2hStats.total}전</div>
                        <div className="text-center w-1/3">
                            <div className="text-2xl font-black text-red-400">{h2hStats.bWins}승</div>
                        </div>
                    </div>
                ) : (statA && statB) ? (
                    <div className="text-center text-sm font-bold text-gray-400 py-4 bg-gray-50 rounded-xl">전적 기록이 없습니다.</div>
                ) : null}
            </div>

            {/* 선택한 상대 전적 상세 기록 */}
            {statA && statB ? (
                <div>
                    <h2 className="font-extrabold text-gray-800 mb-3 text-lg px-1">🧾 상대 전적 상세 기록</h2>
                    {h2hMatches.length > 0 ? (
                        <ul className="space-y-2">
                            {h2hMatches.map(m => {
                                const aWon = m.scoreA > m.scoreB;
                                return (
                                    <li key={m.id} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 text-sm">
                                        <span className="shrink-0 text-[11px] font-black text-gray-400">{m.date}</span>
                                        <div className="min-w-0 flex-1 flex items-center justify-between gap-2 font-extrabold text-gray-700">
                                            <span className={`min-w-0 flex-1 truncate ${aWon ? 'text-blue-600' : 'text-gray-600'}`}>{aWon ? '🏆 ' : ''}{m.playerA_name}</span>
                                            <span className="shrink-0 bg-gray-100 px-2 py-1 rounded-lg font-black text-gray-800">{m.scoreA} : {m.scoreB}</span>
                                            <span className={`min-w-0 flex-1 truncate text-right ${!aWon ? 'text-red-600' : 'text-gray-600'}`}>{!aWon ? '🏆 ' : ''}{m.playerB_name}</span>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <div className="text-center text-sm font-bold text-gray-400 py-4 bg-gray-50 rounded-xl">선택한 선수들의 경기 기록이 없습니다.</div>
                    )}
                </div>
            ) : null}

            {/* 전체 기록 리스트 */}
            <div>
                <div className="flex items-end justify-between gap-3 mb-3 px-1">
                    <div>
                        <h2 className="font-extrabold text-gray-800 text-lg">📅 최근 경기 기록</h2>
                        <p className="text-[11px] font-bold text-gray-400">각 기록의 수정 또는 삭제 버튼을 눌러 바로 관리하세요.</p>
                    </div>
                    <span className="shrink-0 text-xs font-black text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{matches.length}건</span>
                </div>
                {matches.length > 0 ? (
                    <ul className="space-y-3">
                        {matches.map(m => {
                            const aWon = m.scoreA > m.scoreB;
                            const isEditing = editingMatchId === m.id;
                            const isSaving = savingMatchId === m.id;
                            const playerAOptions = getPlayerOptions(m.playerA_id, m.playerA_name);
                            const playerBOptions = getPlayerOptions(m.playerB_id, m.playerB_name);

                            return (
                                <li key={m.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-[10px] font-bold text-gray-400">{m.date}</div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => isEditing ? cancelEditMatch() : startEditMatch(m)}
                                                disabled={isSaving}
                                                className={`text-[11px] font-black px-3 py-1 rounded-full btn-press ${isEditing ? 'bg-gray-200 text-gray-700' : 'bg-blue-50 text-blue-700'}`}
                                            >
                                                {isEditing ? '취소' : '수정'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => deleteMatch(m)}
                                                disabled={isSaving}
                                                className="text-[11px] font-black px-3 py-1 rounded-full bg-red-50 text-red-600 btn-press disabled:opacity-50"
                                            >
                                                삭제
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <span className={`w-1/3 text-center font-extrabold text-base ${aWon ? 'text-blue-600' : 'text-gray-600'}`}>{aWon ? '🏆 ' : ''}{m.playerA_name}</span>
                                        <span className="w-1/3 text-center bg-gray-100 py-1 rounded-lg font-black text-gray-800 text-lg tracking-widest">{m.scoreA} : {m.scoreB}</span>
                                        <span className={`w-1/3 text-center font-extrabold text-base ${!aWon ? 'text-red-600' : 'text-gray-600'}`}>{!aWon ? '🏆 ' : ''}{m.playerB_name}</span>
                                    </div>

                                    {isEditing ? (
                                        <div className="mt-2 bg-gray-50 border border-gray-100 rounded-2xl p-3 space-y-3">
                                            <input
                                                type="date"
                                                value={editDate}
                                                onChange={e => setEditDate(e.target.value)}
                                                className="w-full bg-white border border-gray-200 text-center font-bold text-gray-700 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                                                <select
                                                    value={editPlayerA}
                                                    onChange={e => setEditPlayerA(e.target.value)}
                                                    className="min-w-0 bg-white border border-blue-100 text-blue-800 p-3 rounded-xl font-black outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="" disabled>선수 A</option>
                                                    {playerAOptions.map(member => <option key={member.id} value={member.id}>{member.name} {member.division ? `(${member.division})` : ''}</option>)}
                                                </select>
                                                <span className="font-black text-gray-300 italic">VS</span>
                                                <select
                                                    value={editPlayerB}
                                                    onChange={e => setEditPlayerB(e.target.value)}
                                                    className="min-w-0 bg-white border border-red-100 text-red-800 p-3 rounded-xl font-black outline-none focus:ring-2 focus:ring-red-500"
                                                >
                                                    <option value="" disabled>선수 B</option>
                                                    {playerBOptions.map(member => <option key={member.id} value={member.id}>{member.name} {member.division ? `(${member.division})` : ''}</option>)}
                                                </select>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2">
                                                {SCORE_OPTIONS.map(option => {
                                                    const selected = editScoreA === option.scoreA && editScoreB === option.scoreB;
                                                    return (
                                                        <button
                                                            key={`${option.scoreA}-${option.scoreB}`}
                                                            type="button"
                                                            onClick={() => { setEditScoreA(option.scoreA); setEditScoreB(option.scoreB); }}
                                                            className={`py-3 rounded-xl border-2 font-black btn-press ${selected ? 'bg-gray-900 border-gray-900 text-white' : option.scoreA > option.scoreB ? 'bg-white border-blue-100 text-blue-700' : 'bg-white border-red-100 text-red-700'}`}
                                                        >
                                                            {option.scoreA} : {option.scoreB}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => updateMatch(m)}
                                                disabled={isSaving || !isAuthReady}
                                                className="w-full bg-blue-600 disabled:bg-gray-400 text-white font-black p-3 rounded-xl shadow-md btn-press"
                                            >
                                                {isSaving ? '저장 중...' : '수정 저장'}
                                            </button>
                                        </div>
                                    ) : null}
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <div className="text-center text-sm font-bold text-gray-400 py-6 bg-gray-50 rounded-xl">저장된 경기 기록이 없습니다.</div>
                )}
            </div>
        </div>
    );
}

export default App;
