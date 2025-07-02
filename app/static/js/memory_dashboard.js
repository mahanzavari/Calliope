document.addEventListener('DOMContentLoaded', () => {
     // State
     let currentCategoryId = null;
     let categories = [];
 
     // DOM Elements
     const categoryList = document.getElementById('categoryList');
     const memoryList = document.getElementById('memoryList');
     const addMemoryBtn = document.getElementById('addMemoryBtn');
     const modal = document.getElementById('memoryModal');
     const modalCloseBtn = document.getElementById('modalCloseBtn');
     const memoryForm = document.getElementById('memoryForm');
     const deleteMemoryBtn = document.getElementById('deleteMemoryBtn');
     const modalTitle = document.getElementById('modalTitle');
     const memoryIdInput = document.getElementById('memoryId');
     const memoryTitleInput = document.getElementById('memoryTitle');
     const memoryCategoryInput = document.getElementById('memoryCategory');
     const memoryContentInput = document.getElementById('memoryContent');
     const memoryImportanceInput = document.getElementById('memoryImportance');
 
     // --- API Functions ---
     const api = {
         getCategories: () => fetch('/api/memories/categories').then(res => res.json()),
         getMemories: (categoryId) => fetch(`/api/memories?category_id=${categoryId}`).then(res => res.json()),
         createMemory: (data) => fetch('/api/memories', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(data)
         }).then(res => res.json()),
         updateMemory: (id, data) => fetch(`/api/memories/${id}`, {
             method: 'PUT',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(data)
         }).then(res => res.json()),
         deleteMemory: (id) => fetch(`/api/memories/${id}`, { method: 'DELETE' }).then(res => res.json()),
         verifyMemory: (id) => fetch(`/api/memories/${id}/verify`, { method: 'POST' }).then(res => res.json())
     };
 
     // --- Render Functions ---
     function renderCategories() {
         categoryList.innerHTML = '';
         categories.forEach(cat => {
             const li = document.createElement('li');
             li.className = 'category-item';
             li.dataset.categoryId = cat.id;
             li.innerHTML = `<i class="fas fa-folder"></i><span>${cat.name}</span>`;
             if (cat.id === currentCategoryId) {
                 li.classList.add('active');
             }
             categoryList.appendChild(li);
         });
     }
 
     function renderMemories(memories) {
         memoryList.innerHTML = '';
         if (!memories || memories.length === 0) {
             memoryList.innerHTML = `<div class="empty-state"><i class="fas fa-search"></i><p>No memories in this category.</p></div>`;
             return;
         }
         memories.forEach(mem => {
             const item = document.createElement('div');
             item.className = 'memory-item';
             item.dataset.memoryId = mem.id;
             item.innerHTML = `
                 <div class="memory-header">
                     <h4>${mem.title}</h4>
                     <div class="memory-actions">
                         <button class="verify-btn ${mem.is_verified ? 'verified' : ''}" title="${mem.is_verified ? 'Verified' : 'Click to Verify'}">
                             <i class="fas ${mem.is_verified ? 'fa-check-circle' : 'fa-question-circle'}"></i>
                         </button>
                         <button class="edit-btn" title="Edit Memory"><i class="fas fa-pencil-alt"></i></button>
                     </div>
                 </div>
                 <p class="memory-content">${mem.content}</p>
                 <div class="memory-footer">
                     <span>Importance: ${mem.importance_score.toFixed(1)}</span>
                     <span class="category-badge">${mem.category_name}</span>
                 </div>
             `;
             memoryList.appendChild(item);
         });
     }
 
     // --- Modal Logic ---
     function openModal(memory = null) {
         memoryForm.reset();
         if (memory) {
             modalTitle.textContent = 'Edit Memory';
             memoryIdInput.value = memory.id;
             memoryTitleInput.value = memory.title;
             memoryCategoryInput.value = memory.category_id;
             memoryContentInput.value = memory.content;
             memoryImportanceInput.value = memory.importance_score;
             deleteMemoryBtn.style.display = 'inline-block';
         } else {
             modalTitle.textContent = 'Add New Memory';
             memoryIdInput.value = '';
             deleteMemoryBtn.style.display = 'none';
         }
         modal.style.display = 'flex';
     }
 
     function closeModal() {
         modal.style.display = 'none';
     }
 
     // --- Event Handlers ---
     async function handleCategoryClick(e) {
         const target = e.target.closest('.category-item');
         if (target) {
             currentCategoryId = parseInt(target.dataset.categoryId, 10);
             renderCategories();
             const data = await api.getMemories(currentCategoryId);
             renderMemories(data.memories);
         }
     }
 
     async function handleMemoryFormSubmit(e) {
         e.preventDefault();
         const id = memoryIdInput.value;
         const data = {
             title: memoryTitleInput.value,
             content: memoryContentInput.value,
             category_id: parseInt(memoryCategoryInput.value, 10),
             importance_score: parseFloat(memoryImportanceInput.value)
         };
 
         const response = id ? await api.updateMemory(id, data) : await api.createMemory(data);
         if (response.success) {
             closeModal();
             const memoriesData = await api.getMemories(currentCategoryId);
             renderMemories(memoriesData.memories);
         } else {
             alert(`Error: ${response.error}`);
         }
     }
 
     async function handleDeleteMemory() {
         const id = memoryIdInput.value;
         if (id && confirm('Are you sure you want to delete this memory?')) {
             const response = await api.deleteMemory(id);
             if (response.success) {
                 closeModal();
                 const memoriesData = await api.getMemories(currentCategoryId);
                 renderMemories(memoriesData.memories);
             } else {
                 alert(`Error: ${response.error}`);
             }
         }
     }
 
     async function handleMemoryActionClick(e) {
         const memoryItem = e.target.closest('.memory-item');
         if (!memoryItem) return;
         
         const memoryId = parseInt(memoryItem.dataset.memoryId, 10);
 
         if (e.target.closest('.edit-btn')) {
             // Fetch full memory details to edit
             const memoriesData = await api.getMemories(currentCategoryId);
             const memoryToEdit = memoriesData.memories.find(m => m.id === memoryId);
             if(memoryToEdit) openModal(memoryToEdit);
         } else if (e.target.closest('.verify-btn')) {
             const response = await api.verifyMemory(memoryId);
             if (response.success) {
                 const memoriesData = await api.getMemories(currentCategoryId);
                 renderMemories(memoriesData.memories);
             } else {
                 alert(`Error: ${response.error}`);
             }
         }
     }
 
     // --- Initialization ---
     async function initialize() {
         // Event Listeners
         categoryList.addEventListener('click', handleCategoryClick);
         addMemoryBtn.addEventListener('click', () => openModal());
         modalCloseBtn.addEventListener('click', closeModal);
         window.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
         memoryForm.addEventListener('submit', handleMemoryFormSubmit);
         deleteMemoryBtn.addEventListener('click', handleDeleteMemory);
         memoryList.addEventListener('click', handleMemoryActionClick);
         
         // Initial Data Load
         categories = await api.getCategories();
         renderCategories();
 
         // Populate category dropdown in modal
         memoryCategoryInput.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
         
         // Select first category by default
         if (categories.length > 0) {
             currentCategoryId = categories[0].id;
             renderCategories();
             const data = await api.getMemories(currentCategoryId);
             renderMemories(data.memories);
         }
     }
 
     initialize();
 });
 