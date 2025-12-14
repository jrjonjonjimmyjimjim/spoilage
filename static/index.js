'use strict';

const configForm = document.getElementById('config-form');
window.onload = () => {
    fetch(`/api/summary`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    }).then((response) => {
        if (!response.ok) {
            throw new Error(`Error while fetching: ${response.status}`);
        }
        console.log('Success:', response);
        return response.json();
    }).then((data) => {
        const items = data.items;
        if (items) {
            for (const item of items) {
                _addExistingItemContainer({ item_id: item.item_id, item_name: item.item_name, expires: item.expires, insertAtTop: false });
            }
        }
        const trashDay = data.trash_day;
        configForm.children['trash_day'].value = trashDay;
        const initializingText = document.getElementById('initializing-text');
        initializingText.textContent = 'Spoilage';
    }).catch((error) => {
        console.error('Error fetching items summary:', error);
    })
}

configForm.addEventListener('submit', (event) => {
    event.preventDefault();
    
    const formData = new FormData(configForm);
    const jsonData = Object.fromEntries(formData.entries());
    
    console.info('configForm jsonData', jsonData);
    fetch(`/api/config`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(jsonData),
    }).then((response) => {
        if (!response.ok) {
            throw new Error(`Error while fetching: ${response.status}`);
        }
        console.log('Success:', response);
        return response.json();
    }).then((data) => {
        alert('Configuration saved.');
    }).catch((error) => {
        console.error('Error submitting form:', error);
    });
});

const newItemForm = document.getElementById('new-item-form');
newItemForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(newItemForm);
    const jsonData = Object.fromEntries(formData.entries());
    
    fetch(`/api/item`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(jsonData),
    }).then((response) => {
        if (!response.ok) {
            throw new Error(`Error while fetching: ${response.status}`);
        }
        console.log('Success:', response);
        return response.json();
    }).then((data) => {
        _addExistingItemContainer({ item_id: data.item_id, item_name: data.item_name, expires: data.expires, insertAtTop: true });
        newItemForm.reset();
        const newItemNameField = document.getElementById('new_item_name');
        newItemNameField.focus();
    }).catch((error) => {
        console.error('Error submitting form:', error);
    });
});

const newItemDaysButton3 = newItemForm.children['set-3d-button'];
newItemDaysButton3.onclick = (event) => {
    _setExpiresFromTodayForNewItemForm({ days: 3 });        
}
const newItemDaysButton7 = newItemForm.children['set-7d-button'];
newItemDaysButton7.onclick = (event) => {
    _setExpiresFromTodayForNewItemForm({ days: 7 });
}
const newItemDaysButton28 = newItemForm.children['set-28d-button'];
newItemDaysButton28.onclick = (event) => {
    _setExpiresFromTodayForNewItemForm({ days: 28 });
}
function _setExpiresFromTodayForNewItemForm({ days }) {
    const offsetDate = new Date();
    offsetDate.setDate(offsetDate.getDate() + days);
    newItemForm.children['expires'].value = offsetDate.toISOString().split('T')[0];
}

function _addExistingItemContainer({ item_id, item_name, expires, insertAtTop }) {
    let itemCollection;
    if (insertAtTop) {
        itemCollection = document.getElementById('new-item-collection')
        itemCollection.style.display = 'block';
    } else {
        itemCollection = document.getElementById('existing-item-collection');
    }

    const createdItemContainerTemplate = document.getElementById('existing-item-container-template');
    const createdItemContainer = createdItemContainerTemplate.cloneNode(true);
    createdItemContainer.id = `existing-item-container-${item_id}`;
    const createdItemForm = createdItemContainer.children['existing-item-form-template'];
    createdItemForm.id = `existing-item-form-${item_id}`;
    
    function _setExpiresFromToday({ days }) {
        const offsetDate = new Date();
        offsetDate.setDate(offsetDate.getDate() + days);
        createdItemForm.children['expires'].value = offsetDate.toISOString().split('T')[0];
    }
    const daysButton3 = createdItemForm.children['set-3d-button'];
    daysButton3.onclick = (event) => {
        _setExpiresFromToday({ days: 3 });
    }
    const daysButton7 = createdItemForm.children['set-7d-button'];
    daysButton7.onclick = (event) => {
        _setExpiresFromToday({ days: 7 });
    }
    const daysButton28 = createdItemForm.children['set-28d-button'];
    daysButton28.onclick = (event) => {
        _setExpiresFromToday({ days: 28 });
    }
    
    createdItemForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const formData = new FormData(createdItemForm);
        const jsonData = Object.fromEntries(formData.entries());

        fetch(`/api/item`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(jsonData),
        }).then((response) => {
            if (!response.ok) {
                throw new Error(`Error while fetching: ${response.status}`);
            }
            console.log('Success:', response);
        }).catch((error) => {
            console.error('Error submitting form:', error);
        });
    })

    const createdItemFormRemoveButton = createdItemForm.children['remove-button'];
    createdItemFormRemoveButton.onclick = (event) => {
        fetch(`/api/item`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ item_id: `${item_id}` }),
        }).then((response) => {
            if (!response.ok) {
                throw new Error(`Error while fetching: ${response.status}`);
            }
            console.log('Success:', response);

            createdItemContainer.remove();
        }).catch((error) => {
            console.error('Error submitting form:', error);
        });
    };

    const createdItemFormItemId = createdItemForm.children['item_id'];
    createdItemFormItemId.setAttribute('value', `${item_id}`);
    const createdItemFormItemName = createdItemForm.children['item_name'];
    createdItemFormItemName.setAttribute('value', `${item_name}`);
    const createdItemFormExpires = createdItemForm.children['expires'];
    createdItemFormExpires.setAttribute('value', `${expires}`);
    if (insertAtTop) {
        if (itemCollection.children.length > 0) {
            const firstExistingItemContainer = itemCollection.children[0];
            itemCollection.insertBefore(createdItemContainer, firstExistingItemContainer);
        } else {
            itemCollection.appendChild(createdItemContainer);
        }
    } else {
        itemCollection.appendChild(createdItemContainer);
    }
}