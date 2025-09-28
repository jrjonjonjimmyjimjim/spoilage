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
        console.log('Success:', response);
    }).catch((error) => {
        console.error('Error submitting form:', error);
    });
})