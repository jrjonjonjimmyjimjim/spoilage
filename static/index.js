'use strict';

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
        const initializingText = document.getElementById('initializing-text');
        initializingText.textContent = 'Spoilage';
    }).catch((error) => {
        console.error('Error fetching items summary:', error);
    })
}

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
    }).catch((error) => {
        console.error('Error submitting form:', error);
    });
})

function _addExistingItemContainer({ item_id, item_name, expires, insertAtTop }) {
    const existingItemCollection = document.getElementById('existing-item-collection');
    const createdItemContainerTemplate = document.getElementById('existing-item-container-template');
    const createdItemContainer = createdItemContainerTemplate.cloneNode(true);
    createdItemContainer.id = `existing-item-container-${item_id}`;
    const createdItemForm = createdItemContainer.children['existing-item-form-template'];
    createdItemForm.id = `existing-item-form-${item_id}`;
    
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
        if (existingItemCollection.children.length > 0) {
            const firstExistingItemContainer = existingItemCollection.children[0];
            existingItemCollection.insertBefore(createdItemContainer, firstExistingItemContainer);
        } else {
            existingItemCollection.appendChild(createdItemContainer);
        }
    } else {
        existingItemCollection.appendChild(createdItemContainer);
    }
}