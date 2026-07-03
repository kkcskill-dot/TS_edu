const API_BASE = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.protocol === 'file:' 
    ? 'http://127.0.0.1:8091' 
    : '/tssurvey/api';

let adminToken = localStorage.getItem('tssurvey_admin_token') || '';

const suvApi = {
    setToken(token) {
        adminToken = token;
        localStorage.setItem('tssurvey_admin_token', token);
    },
    logout() {
        adminToken = '';
        localStorage.removeItem('tssurvey_admin_token');
    },
    async checkAuth(token) {
        const res = await fetch(`${API_BASE}/auth`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('401');
        return true;
    },

    async getTopics() {
        const res = await fetch(`${API_BASE}/topics`);
        if (!res.ok) throw new Error('Failed to fetch topics');
        return res.json();
    },

    async createTopic(title, type = 'survey', requireStar = true) {
        const res = await fetch(`${API_BASE}/topics`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ title, type, require_star: requireStar })
        });
        if (!res.ok) throw new Error(res.status === 401 ? '401' : 'Failed to create topic');
        return res.json();
    },

    async toggleTopicStatus(topicId, isActive) {
        const res = await fetch(`${API_BASE}/topics?id=${encodeURIComponent(topicId)}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ is_active: isActive })
        });
        if (!res.ok) throw new Error(res.status === 401 ? '401' : 'Failed to update topic status');
        return res.json();
    },

    async getResponses(topicId) {
        const res = await fetch(`${API_BASE}/responses?topic_id=${encodeURIComponent(topicId)}`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (!res.ok) throw new Error(res.status === 401 ? '401' : 'Failed to fetch responses');
        return res.json();
    },

    async submitResponse(topicId, starRating, comment) {
        const res = await fetch(`${API_BASE}/responses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic_id: topicId, star_rating: starRating, comment })
        });
        if (!res.ok) throw new Error('Failed to submit response');
        return res.json();
    },

    async submitApply(topicId, department, name, comment) {
        const res = await fetch(`${API_BASE}/responses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic_id: topicId, department, name, comment })
        });
        if (!res.ok) throw new Error('Failed to submit application');
        return res.json();
    },

    async deleteTopic(topicId) {
        const res = await fetch(`${API_BASE}/topics?id=${encodeURIComponent(topicId)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (!res.ok) throw new Error(res.status === 401 ? '401' : 'Failed to delete topic');
        return res.json();
    }
};
