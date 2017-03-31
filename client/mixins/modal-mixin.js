var modalMixin = {
    data: function() {
        return {
            shown: false
        }
    },
    methods: {
        closeModal: function() {
            this.shown = false;
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
