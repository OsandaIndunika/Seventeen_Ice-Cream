
package com.seventeen.project.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class OutletShiftService {

    private final JdbcTemplate jdbc;

    public OutletShiftService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private ResponseStatusException conflict(String message) {
        return new ResponseStatusException(
                HttpStatus.CONFLICT,
                message
        );
    }

    // ==========================================
    // IDENTIFY LOGGED-IN OUTLET MANAGER
    // ==========================================

    private long managerId(String email) {

        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Please log in again"
            );
        }

        List<Long> ids = jdbc.queryForList(
                """
                SELECT id
                FROM public.app_users
                WHERE LOWER(email) = LOWER(?)
                  AND role = 'OUTLET_MANAGER'
                  AND enabled = TRUE
                """,
                Long.class,
                email.trim()
        );

        if (ids.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Outlet Manager account required"
            );
        }

        return ids.get(0);
    }

    // ==========================================
    // FIND THE OUTLET ALREADY ASSIGNED
    // ==========================================

    private long assignedOutlet(long managerId) {

        List<Long> ids = jdbc.queryForList(
                """
                SELECT id
                FROM public.outlet_pos_locations
                WHERE manager_user_id = ?
                  AND active = TRUE
                ORDER BY id
                LIMIT 1
                """,
                Long.class,
                managerId
        );

        if (ids.isEmpty()) {
            throw conflict(
                    "No active outlet assigned to your account"
            );
        }

        return ids.get(0);
    }

    // ==========================================
    // LOCK MANAGER FOR CONCURRENT START/END
    // ==========================================

    private void lockManager(long managerId) {

        List<Long> ids = jdbc.queryForList(
                """
                SELECT id
                FROM public.app_users
                WHERE id = ?
                FOR UPDATE
                """,
                Long.class,
                managerId
        );

        if (ids.isEmpty()) {
            throw conflict("Manager account not found");
        }
    }

    // ==========================================
    // LOOK UP ACTIVE SHIFT
    // ==========================================

    private Map<String, Object> findActiveShift(
            long managerId
    ) {

        List<Map<String, Object>> rows =
                jdbc.queryForList(
                        """
                        SELECT
                            s.id AS "shiftId",
                            s.manager_user_id AS "managerUserId",
                            s.outlet_id AS "outletId",
                            o.outlet_name AS "outletName",
                            s.shift_date AS "shiftDate",
                            s.started_at AS "startedAt",
                            s.status AS "status",
                            GREATEST(
                                0,
                                FLOOR(
                                    EXTRACT(
                                        EPOCH FROM (
                                            CURRENT_TIMESTAMP
                                            - s.started_at
                                        )
                                    )
                                )::bigint
                            ) AS "elapsedSeconds"
                        FROM public.outlet_manager_shifts s
                        JOIN public.outlet_pos_locations o
                          ON o.id = s.outlet_id
                        WHERE s.manager_user_id = ?
                          AND s.status = 'ACTIVE'
                          AND s.ended_at IS NULL
                        ORDER BY s.started_at DESC
                        LIMIT 1
                        """,
                        managerId
                );

        if (rows.isEmpty()) {
            return Map.of("active", false);
        }

        Map<String, Object> result =
                new LinkedHashMap<>(rows.get(0));

        result.put("active", true);

        return result;
    }

    // ==========================================
    // GET CURRENT SHIFT STATUS
    // GET /api/outlet/shifts/active
    // ==========================================

    @Transactional(readOnly = true)
    public Map<String, Object> currentShift(String email) {
        return findActiveShift(managerId(email));
    }

    // ==========================================
    // START SHIFT
    // POST /api/outlet/shifts/start
    // ==========================================

    @Transactional
    public Map<String, Object> startShift(String email) {

        long managerId = managerId(email);

        // Prevent two browser tabs from creating
        // two active shifts for the same manager.
        lockManager(managerId);

        // Repeated Start Shift clicks will return
        // the existing active shift.
        Map<String, Object> existing =
                findActiveShift(managerId);

        if (Boolean.TRUE.equals(existing.get("active"))) {
            return existing;
        }

        long outletId = assignedOutlet(managerId);

        Long shiftId = jdbc.queryForObject(
                """
                INSERT INTO public.outlet_manager_shifts (
                    manager_user_id,
                    outlet_id,
                    shift_date,
                    started_at,
                    status
                )
                VALUES (
                    ?,
                    ?,
                    (
                        CURRENT_TIMESTAMP
                        AT TIME ZONE 'Asia/Colombo'
                    )::date,
                    CURRENT_TIMESTAMP,
                    'ACTIVE'
                )
                RETURNING id
                """,
                Long.class,
                managerId,
                outletId
        );

        if (shiftId == null) {
            throw conflict("Unable to start shift");
        }

        return findActiveShift(managerId);
    }

    // ==========================================
    // END SHIFT
    // POST /api/outlet/shifts/end
    // ==========================================

    @Transactional
    public Map<String, Object> endShift(String email) {

        long managerId = managerId(email);

        lockManager(managerId);

        List<Long> activeIds = jdbc.queryForList(
                """
                SELECT id
                FROM public.outlet_manager_shifts
                WHERE manager_user_id = ?
                  AND status = 'ACTIVE'
                  AND ended_at IS NULL
                ORDER BY started_at DESC
                LIMIT 1
                FOR UPDATE
                """,
                Long.class,
                managerId
        );

        if (activeIds.isEmpty()) {
            throw conflict("No active shift to end");
        }

        return jdbc.queryForMap(
                """
                UPDATE public.outlet_manager_shifts
                SET
                    ended_at = CURRENT_TIMESTAMP,

                    work_seconds = GREATEST(
                        0,
                        FLOOR(
                            EXTRACT(
                                EPOCH FROM (
                                    CURRENT_TIMESTAMP - started_at
                                )
                            )
                        )::bigint
                    ),

                    status = 'COMPLETED'

                WHERE id = ?
                  AND manager_user_id = ?
                  AND status = 'ACTIVE'
                  AND ended_at IS NULL

                RETURNING
                    id AS "shiftId",
                    outlet_id AS "outletId",
                    shift_date AS "shiftDate",
                    started_at AS "startedAt",
                    ended_at AS "endedAt",
                    work_seconds AS "workSeconds",
                    status
                """,
                activeIds.get(0),
                managerId
        );
    }

    // ==========================================
    // GET WORKING HISTORY
    // GET /api/outlet/shifts/history
    // ==========================================

    @Transactional(readOnly = true)
    public List<Map<String, Object>> history(String email) {

        long managerId = managerId(email);

        return jdbc.queryForList(
                """
                SELECT
                    s.id AS "shiftId",
                    s.shift_date AS "shiftDate",
                    o.outlet_name AS "outletName",
                    s.started_at AS "startedAt",
                    s.ended_at AS "endedAt",
                    s.work_seconds AS "workSeconds",
                    s.status AS "status"
                FROM public.outlet_manager_shifts s
                JOIN public.outlet_pos_locations o
                  ON o.id = s.outlet_id
                WHERE s.manager_user_id = ?
                ORDER BY s.started_at DESC
                LIMIT 100
                """,
                managerId
        );
    }
}
