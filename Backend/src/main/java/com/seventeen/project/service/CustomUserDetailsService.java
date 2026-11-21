
package com.seventeen.project.service;

import com.seventeen.project.model.AppUser;
import com.seventeen.project.repository.UserRepository;

import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    public CustomUserDetailsService(
            UserRepository userRepository
    ) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String email)
            throws UsernameNotFoundException {

        String normalizedEmail = email.trim()
                .toLowerCase(Locale.ROOT);

        AppUser appUser = userRepository
                .findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() ->
                        new UsernameNotFoundException(
                                "User not found"
                        )
                );

        return User.builder()
                .username(appUser.getEmail())
                .password(appUser.getPassword())
                .authorities(
                        "ROLE_" + appUser.getRole().name()
                )
                .disabled(!appUser.isEnabled())
                .build();
    }
}
