var modalMixin = {
    data: function() {
        return {
            shown: false
        }
    },
    methods: {
        closeModal: function() {
            this.shown = false;
        }
    },
    beforeMount: function() {

    }
};

module.exports = modalMixin;