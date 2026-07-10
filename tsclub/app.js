const API_URL = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.protocol === 'file:' 
    ? 'http://127.0.0.1:8092' 
    : '/tsclub/api';

let currentGroupId = null;
let currentPollId = null;
let adminToken = localStorage.getItem('tsclub_admin_token') || '';

function updateAdminUI() {
    if (adminToken) {
        document.getElementById('admin-login-btn').style.display = 'none';
        document.getElementById('admin-logout-btn').style.display = 'inline-flex';
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'inline-flex');
    } else {
        document.getElementById('admin-login-btn').style.display = 'inline-flex';
        document.getElementById('admin-logout-btn').style.display = 'none';
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }
}

function logoutAdmin() {
    adminToken = '';
    localStorage.removeItem('tsclub_admin_token');
    updateAdminUI();
    loadPolls(); // Re-render to hide close buttons
}

async function verifyAuth(token) {
    const res = await fetch(`${API_URL}/auth`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return res.ok;
}

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
    currentGroupId = groupId;
    document.getElementById('detail-title').textContent = title;
    
    loadNotices();
    loadPolls();
}

// API Calls
async function loadGroups() {
    try {
        const res = await fetch(`${API_URL}/groups`);
        const data = await res.json();
        const container = document.getElementById('groups-container');
        container.innerHTML = '';
        
        if (!data.data || data.data.length === 0) {
            container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--sph-muted);">등록된 소모임이 없습니다.</div>';
            return;
        }

        data.data.forEach(g => {
            const card = document.createElement('div');
            card.className = 'club-card';
            card.style.position = 'relative'; // For absolute positioning of delete btn
            card.onclick = (e) => {
                // Don't trigger if clicking delete button
                if(e.target.closest('.delete-group-btn')) return;
                openGroupDetail(g.id, g.title);
            };
            
            let adminHtml = '';
            if(adminToken) {
                adminHtml = `<button class="delete-group-btn" onclick="deleteGroup('${g.id}', '${g.title}')" style="position:absolute; top:12px; right:12px; background:none; border:none; cursor:pointer; color:#ef4444; padding:4px;"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>`;
            }

            card.innerHTML = `
                ${adminHtml}
                <div class="club-title">${g.title}</div>
                <div class="club-desc">${g.description || '설명이 없습니다.'}</div>
                <div class="club-meta">
                    <span>👤 등록: ${g.creator_name}</span>
                    <span>👥 참석 예상: ${g.participants_count}명</span>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (err) {
        console.error(err);
    }
}

async function loadNotices() {
    if (!currentGroupId) return;
    try {
        const res = await fetch(`${API_URL}/groups/${currentGroupId}/notices`);
        const data = await res.json();
        const container = document.getElementById('notices-container');
        container.innerHTML = '';
        
        if (!data.data || data.data.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:30px; color:var(--sph-muted); font-size:0.9rem;">등록된 공지가 없습니다.</div>';
            return;
        }

        data.data.forEach(n => {
            const item = document.createElement('div');
            item.className = 'timeline-item';
            
            let adminHtml = '';
            if(adminToken) {
                adminHtml = `
                    <div style="margin-top:8px; display:flex; gap:8px;">
                        <button onclick="editNotice('${n.id}', '${n.session_no}', '${n.date_info}', '${n.location}', '${n.content}')" style="background:none; border:none; cursor:pointer; color:var(--sph-blue); font-size:0.8rem; padding:0;">수정</button>
                        <button onclick="deleteNotice('${n.id}')" style="background:none; border:none; cursor:pointer; color:#ef4444; font-size:0.8rem; padding:0;">삭제</button>
                    </div>
                `;
            }

            item.innerHTML = `
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                    <div class="timeline-title">${n.session_no}회차 <span style="font-weight:400; font-size:0.85rem; color:var(--sph-slate); margin-left:8px;">${n.date_info} / ${n.location || '미정'}</span></div>
                    <div class="timeline-body">${n.content || ''}</div>
                    ${adminHtml}
                </div>
            `;
            container.appendChild(item);
        });
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
                
                let actionHtml = '';
                if (p.is_closed) {
                    actionHtml = `<span style="display:inline-block; padding:6px 12px; background:var(--sph-gray); color:var(--sph-muted); font-size:0.85rem; border-radius:4px; font-weight:600;">종료된 투표입니다</span>`;
                } else {
                    actionHtml = `
                        ${adminToken ? `<button class="btn-secondary" style="padding:6px 16px; font-size:0.85rem; margin-right:8px; border-color:#e11d48; color:#e11d48;" onclick="closePoll('${p.id}')">투표 종료</button>` : ''}
                        <button class="btn-primary" style="padding:6px 16px; font-size:0.85rem;" onclick="openVoteModal('${p.id}', '${p.options.join(',')}')">투표하기</button>
                    `;
                }
                
                if (adminToken) {
                    actionHtml = `<button class="btn-secondary" style="padding:6px 16px; font-size:0.85rem; margin-right:8px; border:color:var(--sph-gray);" onclick="deletePoll('${p.id}')">삭제</button>` + actionHtml;
                }

                item.innerHTML = `
                    <div class="poll-title">${p.title} <span style="font-size:0.8rem; color:var(--sph-slate); font-weight:400; margin-left:8px;">(총 ${totalVotes}명 참여)</span></div>
                    <div class="poll-options">
                        ${optionsHtml}
                    </div>
                    <div style="margin-top:16px; text-align:right;">
                        ${actionHtml}
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

async function closePoll(pollId) {
    if(!confirm("이 투표를 종료하시겠습니까? 더 이상 투표를 받을 수 없습니다.")) return;
    try {
        const res = await fetch(`${API_URL}/polls/${pollId}/close`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        if(res.ok) {
            loadPolls();
        } else {
            alert("투표 종료 실패 (권한 확인 필요)");
        }
    } catch(err) {
        alert("오류 발생");
    }
}

async function deleteGroup(groupId, title) {
    if(!confirm(`'${title}' 소모임을 삭제하시겠습니까?\n관련된 모든 공지와 투표가 함께 삭제됩니다.`)) return;
    try {
        const res = await fetch(`${API_URL}/groups/${groupId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if(res.ok) loadGroups();
        else alert("삭제 권한이 없거나 오류가 발생했습니다.");
    } catch(err) { alert("오류 발생"); }
}

async function deleteNotice(noticeId) {
    if(!confirm("이 공지를 삭제하시겠습니까?")) return;
    try {
        const res = await fetch(`${API_URL}/notices/${noticeId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if(res.ok) loadNotices();
        else alert("삭제 오류");
    } catch(err) { alert("오류 발생"); }
}

async function deletePoll(pollId) {
    if(!confirm("이 투표를 삭제하시겠습니까? 투표 결과가 모두 사라집니다.")) return;
    try {
        const res = await fetch(`${API_URL}/polls/${pollId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if(res.ok) loadPolls();
        else alert("삭제 오류");
    } catch(err) { alert("오류 발생"); }
}

let editingNoticeId = null;
function editNotice(id, session, date, loc, content) {
    editingNoticeId = id;
    const form = document.querySelector('#createNoticeModal form');
    form.querySelector('[name="session_no"]').value = session;
    form.querySelector('[name="date_info"]').value = date;
    form.querySelector('[name="location"]').value = loc;
    form.querySelector('[name="content"]').value = content;
    document.querySelector('#createNoticeModal .modal-title').textContent = "공지 수정";
    openModal('createNoticeModal');
}

// Override openModal specifically to reset title for notice
const originalOpenModal = openModal;
openModal = function(id) {
    if(id === 'createNoticeModal' && !editingNoticeId) {
        document.querySelector('#createNoticeModal .modal-title').textContent = "공지 등록";
    }
    originalOpenModal(id);
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
        const res = await fetch(`${API_URL}/groups`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify(data)
        });
        if(!res.ok) {
            alert("권한이 없거나 오류가 발생했습니다.");
            return;
        }
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
        let res;
        if (editingNoticeId) {
            res = await fetch(`${API_URL}/notices/${editingNoticeId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`
                },
                body: JSON.stringify(data)
            });
        } else {
            res = await fetch(`${API_URL}/groups/${currentGroupId}/notices`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`
                },
                body: JSON.stringify(data)
            });
        }
        
        if(!res.ok) {
            alert("권한이 없거나 오류가 발생했습니다.");
            return;
        }
        closeModal('createNoticeModal');
        editingNoticeId = null;
        loadNotices();
    } catch (err) {
        alert("저장 중 오류가 발생했습니다.");
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
        const res = await fetch(`${API_URL}/groups/${currentGroupId}/polls`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify(data)
        });
        if(!res.ok) {
            alert("권한이 없거나 오류가 발생했습니다.");
            return;
        }
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

document.getElementById('adminAuthForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const pwd = fd.get('password');
    try {
        const ok = await verifyAuth(pwd);
        if(ok) {
            adminToken = pwd;
            localStorage.setItem('tsclub_admin_token', adminToken);
            updateAdminUI();
            closeModal('adminAuthModal');
            loadPolls(); // Refresh UI in case we need to show close buttons
        } else {
            alert("비밀번호가 일치하지 않습니다.");
        }
    } catch(err) {
        alert("인증 오류");
    }
});

// Init
window.addEventListener('DOMContentLoaded', () => {
    updateAdminUI();
    loadGroups();
    if(adminToken) {
        verifyAuth(adminToken).then(ok => {
            if(!ok) logoutAdmin();
        }).catch(err => logoutAdmin());
    }
});
