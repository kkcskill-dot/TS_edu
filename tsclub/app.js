const API_BASE = '/tsclub/api'; // Assuming Nginx routes this to 8092, for local testing we use relative if no Nginx
// Local dev fallback
const API_URL = location.port === '8000' || location.port === '5500' ? 'http://localhost:8092' : '/tsclub/api';

let currentGroupId = null;
let currentPollId = null;

// Modal Logic
function openModal(id) {
    document.getElementById(id).classList.add('active');
}
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    // reset form
    const form = document.querySelector(`#${id} form`);
    if(form) form.reset();
}

// Navigation Logic
function showList() {
    document.getElementById('detail-view').style.display = 'none';
    document.getElementById('list-view').style.display = 'block';
    currentGroupId = null;
    loadGroups();
}

function showDetail(group) {
    document.getElementById('list-view').style.display = 'none';
    document.getElementById('detail-view').style.display = 'block';
    
    currentGroupId = group.id;
    document.getElementById('detail-title').textContent = group.title;
    document.getElementById('detail-desc').textContent = group.description;
    
    loadNotices();
    loadPolls();
}

// API Calls
async function loadGroups() {
    try {
        const res = await fetch(`${API_URL}/groups`);
        const json = await res.json();
        const container = document.getElementById('groups-container');
        container.innerHTML = '';
        
        if (json.data && json.data.length > 0) {
            json.data.forEach(g => {
                const card = document.createElement('div');
                card.className = 'club-card';
                card.onclick = () => showDetail(g);
                card.innerHTML = `
                    <h3 class="club-card-title">${g.title}</h3>
                    <div class="club-card-desc">${g.description || '설명이 없습니다.'}</div>
                    <div class="club-card-meta">
                        <span>👤 등록: ${g.creator_name}</span>
                        <span>👥 참석 예상: ${g.participants_count}명</span>
                    </div>
                `;
                container.appendChild(card);
            });
        } else {
            container.innerHTML = '<p style="color:var(--sph-muted);">등록된 소모임이 없습니다.</p>';
        }
    } catch (err) {
        console.error(err);
    }
}

async function loadNotices() {
    if (!currentGroupId) return;
    try {
        const res = await fetch(`${API_URL}/groups/${currentGroupId}/notices`);
        const json = await res.json();
        const container = document.getElementById('notices-container');
        container.innerHTML = '';
        
        if (json.data && json.data.length > 0) {
            json.data.forEach(n => {
                const item = document.createElement('div');
                item.className = 'notice-item';
                item.innerHTML = `
                    <div class="notice-session">${n.session_no}회차 공지</div>
                    <div class="notice-meta">
                        <span>🗓 ${n.date_info}</span>
                        <span>📍 ${n.location || '미정'}</span>
                    </div>
                    <div style="font-size:0.95rem; color:var(--sph-ink);">${n.content || ''}</div>
                `;
                container.appendChild(item);
            });
        } else {
            container.innerHTML = '<p style="color:var(--sph-muted); font-size:0.9rem;">아직 등록된 공지가 없습니다.</p>';
        }
    } catch (err) {
        console.error(err);
    }
}

async function loadPolls() {
    if (!currentGroupId) return;
    try {
        const res = await fetch(`${API_URL}/groups/${currentGroupId}/polls`);
        const json = await res.json();
        const container = document.getElementById('polls-container');
        container.innerHTML = '';
        
        if (json.data && json.data.length > 0) {
            json.data.forEach(p => {
                const item = document.createElement('div');
                item.className = 'poll-item';
                
                // Calculate totals
                const totalVotes = p.votes.length;
                const dateCounts = {};
                p.options.forEach(opt => dateCounts[opt] = { count: 0, voters: [] });
                
                p.votes.forEach(v => {
                    let dates = [];
                    try { dates = JSON.parse(v.selected_dates); } catch(e){}
                    dates.forEach(d => {
                        if(dateCounts[d]) {
                            dateCounts[d].count++;
                            dateCounts[d].voters.push(v.voter_name);
                        }
                    });
                });
                
                let optionsHtml = '';
                p.options.forEach(opt => {
                    const c = dateCounts[opt].count;
                    const pct = totalVotes > 0 ? Math.round((c / totalVotes) * 100) : 0;
                    const votersStr = dateCounts[opt].voters.join(', ');
                    optionsHtml += `
                        <div class="poll-option">
                            <div style="width:80px; font-weight:600; font-size:0.9rem;">${opt}</div>
                            <div class="poll-bar-container">
                                <div class="poll-bar" style="width: ${pct}%"></div>
                            </div>
                            <div class="poll-votes">${c}표</div>
                        </div>
                        ${votersStr ? `<div class="vote-voters" style="margin-left:92px; margin-bottom:8px; margin-top:0; border:none; padding:0;">선택: ${votersStr}</div>` : ''}
                    `;
                });
                
                item.innerHTML = `
                    <div class="poll-title">${p.title} <span style="font-size:0.8rem; color:var(--sph-slate); font-weight:400; margin-left:8px;">(총 ${totalVotes}명 참여)</span></div>
                    <div class="poll-options">
                        ${optionsHtml}
                    </div>
                    <div style="margin-top:16px; text-align:right;">
                        <button class="btn-primary" style="padding:6px 16px; font-size:0.85rem;" onclick="openVoteModal('${p.id}', '${p.options.join(',')}')">투표하기</button>
                    </div>
                `;
                container.appendChild(item);
            });
        } else {
            container.innerHTML = '<p style="color:var(--sph-muted); font-size:0.9rem;">진행 중인 투표가 없습니다.</p>';
        }
    } catch (err) {
        console.error(err);
    }
}

function openVoteModal(pollId, optionsStr) {
    currentPollId = pollId;
    const options = optionsStr.split(',').map(s => s.trim());
    const container = document.getElementById('vote-options-container');
    container.innerHTML = '';
    
    options.forEach(opt => {
        const label = document.createElement('label');
        label.className = 'checkbox-label';
        label.innerHTML = `<input type="checkbox" name="dates" value="${opt}"> ${opt}`;
        container.appendChild(label);
    });
    
    openModal('voteModal');
}

// Form Submissions
document.getElementById('createGroupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
        title: fd.get('title'),
        description: fd.get('description'),
        participants_count: parseInt(fd.get('participants_count')),
        creator_name: fd.get('creator_name')
    };
    
    try {
        await fetch(`${API_URL}/groups`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        closeModal('createGroupModal');
        loadGroups();
    } catch (err) {
        alert("등록 실패");
    }
});

document.getElementById('createNoticeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentGroupId) return;
    
    const fd = new FormData(e.target);
    const data = {
        session_no: parseInt(fd.get('session_no')),
        date_info: fd.get('date_info'),
        location: fd.get('location'),
        content: fd.get('content')
    };
    
    try {
        await fetch(`${API_URL}/groups/${currentGroupId}/notices`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        closeModal('createNoticeModal');
        loadNotices();
    } catch (err) {
        alert("등록 실패");
    }
});

document.getElementById('createPollForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentGroupId) return;
    
    const fd = new FormData(e.target);
    const options = fd.get('options').split(',').map(s => s.trim()).filter(s => s);
    const data = {
        title: fd.get('title'),
        options: options
    };
    
    try {
        await fetch(`${API_URL}/groups/${currentGroupId}/polls`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        closeModal('createPollModal');
        loadPolls();
    } catch (err) {
        alert("등록 실패");
    }
});

document.getElementById('voteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentPollId) return;
    
    const fd = new FormData(e.target);
    const dates = fd.getAll('dates');
    if (dates.length === 0) {
        alert("최소 1개 이상의 일자를 선택해주세요.");
        return;
    }
    
    const data = {
        voter_name: fd.get('voter_name'),
        selected_dates: dates
    };
    
    try {
        const res = await fetch(`${API_URL}/polls/${currentPollId}/vote`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if(!json.ok) {
            alert(json.error || "투표 실패");
        } else {
            closeModal('voteModal');
            loadPolls();
        }
    } catch (err) {
        alert("투표 중 오류가 발생했습니다.");
    }
});

// Init
window.addEventListener('DOMContentLoaded', () => {
    loadGroups();
});
