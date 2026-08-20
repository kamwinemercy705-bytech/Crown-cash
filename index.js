// Crown Cash — index.js

document.addEventListener("DOMContentLoaded", function () {

    const menuToggle = document.getElementById("menuToggle");
    const mainNav = document.getElementById("mainNav");

    if (menuToggle && mainNav) {

        menuToggle.addEventListener("click", function () {

            mainNav.classList.toggle("active");

        });

    }


    const year = document.getElementById("year");

    if (year) {

        year.textContent = new Date().getFullYear();

    }

});