'use strict';
const newItemForm = document.getElementById('new-item-form');

newItemForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(newItemForm);
    const jsonData = Object.fromEntries(formData.entries());
    
    fetch('http://localhost:8080/api/item', {
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
        const mainContainer = document.getElementById('main-container');
        const createdItemContainerTemplate = document.getElementById('existing-item-container-template');
        const createdItemContainer = createdItemContainerTemplate.cloneNode(true);
        createdItemContainer.id = `existing-item-container-${data.id}`;
        const createdItemForm = createdItemContainer.children['existing-item-form-template'];
        createdItemForm.id = `existing-item-form-${data.id}`;
        const createdItemFormItemName = createdItemForm.children['item_name'];
        createdItemFormItemName.setAttribute('value', `${data.item_name}`);
        const createdItemFormExpires = createdItemForm.children['expires'];
        createdItemFormExpires.setAttribute('value', `${data.expires}`);
        mainContainer.appendChild(createdItemContainer);
    }).catch((error) => {
        console.error('Error submitting form:', error);
    });
})