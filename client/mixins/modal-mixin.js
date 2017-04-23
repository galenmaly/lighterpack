var modalMixin = {
    data: function() {
        return {
            shown: false,
            modalClasses: ''
        }
    },
    methods: {
        closeModal: function() {
            this.modalClasses = 'fadeout';
            setTimeout(() => {
                this.shown = false;
                this.modalClasses = '';
            }, 250);
            
            this.unbindEscapeToClose();
        },
        openModal: function() {
            this.shown = true;
            this.bindEscapeToClose();
        },
        bindEscapeToClose: function() {
            window.addEventListener('keyup', this.closeOnEscape);
        },
        unbindEscapeToClose: function() {
            window.removeEventListener('keyup', this.closeOnEscape);
        },
        closeOnEscape: function(evt) {
            if (evt.keyCode === 27) {
                this.closeModal();
            }
        }
    },
    beforeMount: function() {

    }
};

module.exports = modalMixin;
